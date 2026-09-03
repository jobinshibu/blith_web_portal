/**
 * Sound-Like / Phonetic Matching Utilities  —  Professional Edition
 *
 * Algorithm Stack (in order of precision):
 *  1. Double Metaphone  (npm: double-metaphone)  — industry-standard phonetic encoding.
 *                       Returns TWO codes (primary + alternate) per word, covering
 *                       cross-language variants, silent letters & regional pronunciations.
 *                       Far more accurate than standard Metaphone or Soundex alone.
 *
 *  2. Soundex           — classic phonetic fallback for edge cases Double Metaphone may miss.
 *
 *  3. Jaro-Winkler Similarity — string-similarity metric optimised for short strings (names,
 *                       event titles, locations). Outperforms Levenshtein on short tokens
 *                       because it weights prefix matches and character transpositions.
 *
 *  4. Levenshtein Distance — raw edit-distance, used as a final typo-tolerance gate.
 *
 * Public API (backward-compatible with previous version):
 *  - isSoundLikeMatch(queryToken, targetText) → boolean   ← main export used in Events.jsx
 *  - soundex(word)                            → string    ← utility
 *  - levenshteinDistance(a, b)                → number    ← utility
 *  - jaroWinklerSimilarity(s1, s2)            → number    ← utility (0–1)
 *  - createFuseIndex(events, keys)            → Fuse      ← collection-level fuzzy search
 */

import { doubleMetaphone } from 'double-metaphone';
import Fuse from 'fuse.js';

/* ══════════════════════════════════════════════════════════════════════════════
   1.  SOUNDEX  (secondary phonetic fallback)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Standard American Soundex algorithm.
 * @param {string} word
 * @returns {string} 4-character Soundex code (e.g. 'C530')
 */
export const soundex = (word) => {
  if (!word || typeof word !== 'string') return '';
  const clean = word.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return '';

  const MAP = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };

  let result = clean[0];
  let prevCode = MAP[clean[0]] || '0';

  for (let i = 1; i < clean.length; i++) {
    const code = MAP[clean[i]] || '0';
    if (code !== '0' && code !== prevCode) result += code;
    prevCode = code;
    if (result.length === 4) break;
  }

  return result.padEnd(4, '0');
};

/* ══════════════════════════════════════════════════════════════════════════════
   2.  JARO-WINKLER SIMILARITY
   Returns a score in [0, 1].  1 = identical strings.
   Better than Levenshtein for short strings because it:
     • Penalises character transpositions (not just substitutions)
     • Rewards common prefixes (very effective for names & event words)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Computes Jaro-Winkler similarity between two strings.
 * @param {string} s1
 * @param {string} s2
 * @returns {number} Similarity score 0–1 (1 = perfect match)
 */
export const jaroWinklerSimilarity = (s1, s2) => {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);

  const s1Matched = new Uint8Array(len1);
  const s2Matched = new Uint8Array(len2);

  let matches = 0;

  // Find matching characters
  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchDist);
    const hi = Math.min(i + matchDist + 1, len2);
    for (let j = lo; j < hi; j++) {
      if (s2Matched[j] || s1[i] !== s2[j]) continue;
      s1Matched[i] = 1;
      s2Matched[j] = 1;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matched[i]) continue;
    while (!s2Matched[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix bonus — up to first 4 characters
  let prefix = 0;
  const cap = Math.min(4, len1, len2);
  for (let i = 0; i < cap; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
};

/* ══════════════════════════════════════════════════════════════════════════════
   3.  LEVENSHTEIN DISTANCE  (kept as utility)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Standard Levenshtein edit distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number} Edit distance
 */
export const levenshteinDistance = (a, b) => {
  if (!a || !b) return (a || '').length + (b || '').length;
  const m = a.length;
  const n = b.length;
  // Single-row optimisation — O(n) space instead of O(m*n)
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
};

/* ══════════════════════════════════════════════════════════════════════════════
   4.  INTERNAL — Double Metaphone word-pair comparison
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Returns true if two words are phonetically equivalent using Double Metaphone.
 * Checks all combinations of primary + alternate codes for maximum coverage.
 * Falls back to Soundex if Double Metaphone codes are empty (very short words).
 * @param {string} w1  — pre-cleaned lowercase word
 * @param {string} w2  — pre-cleaned lowercase word
 * @returns {boolean}
 */
const arePhoneticallySimilar = (w1, w2) => {
  if (!w1 || !w2) return false;

  // Double Metaphone — each word yields [primaryCode, alternateCode]
  const [dm1a, dm1b] = doubleMetaphone(w1);
  const [dm2a, dm2b] = doubleMetaphone(w2);

  // Any combination of codes aligning = phonetic match
  if (dm1a && dm2a && dm1a === dm2a) return true;
  if (dm1a && dm2b && dm2b && dm1a === dm2b) return true;
  if (dm1b && dm1b && dm2a && dm1b === dm2a) return true;
  if (dm1b && dm2b && dm1b && dm2b && dm1b === dm2b) return true;

  // Soundex secondary fallback — only when both words have rich codes (non-trivial)
  const sx1 = soundex(w1);
  const sx2 = soundex(w2);
  if (sx1 && sx2 && sx1 === sx2 && !sx1.endsWith('00')) {
    if (Math.abs(w1.length - w2.length) <= 1) return true;
  }

  return false;
};

/* ══════════════════════════════════════════════════════════════════════════════
   5.  isSoundLikeMatch  — Main Export
   Checks whether a search query token phonetically / fuzzily matches any word
   in the target text field.

   API is fully backward-compatible with the previous soundLike.js version;
   Events.jsx requires zero changes.

   Matching layers (ordered cheapest → most expensive):
     A. Double Metaphone    — phonetic coding match (primary + alternate codes)
     B. Jaro-Winkler        — similarity threshold for short/medium tokens
     C. Levenshtein         — edit-distance gate as final typo-tolerance check
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Returns true if queryToken sounds like, or is a fuzzy match for, any word
 * in targetText.
 *
 * @param {string} queryToken  — A single normalised token from the user's search input
 * @param {string} targetText  — A text field from an event (title, category, about, etc.)
 * @returns {boolean}
 */
export const isSoundLikeMatch = (queryToken, targetText) => {
  if (!queryToken || !targetText || typeof targetText !== 'string') return false;

  const qClean = queryToken.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (qClean.length < 3) return false;  // Prevents false positives on tiny tokens

  // Tokenise target text into individual words; cap at 60 for very long 'about' fields
  const words = targetText
    .toLowerCase()
    .split(/[\s,#&_./:;!?()\-\[\]]+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length >= 2)
    .slice(0, 60);

  if (words.length === 0) return false;

  // ── Layer A: Double Metaphone phonetic match ─────────────────────────────
  // Most powerful layer — handles "nite"→"night", "komedy"→"comedy", etc.
  for (const word of words) {
    if (arePhoneticallySimilar(qClean, word)) return true;
  }

  // ── Layer B: Jaro-Winkler similarity ────────────────────────────────────
  // Catches transpositions and near-misses that phonetic encoding misses.
  // Threshold scales with token length — stricter for short tokens to avoid noise.
  const jwThreshold = qClean.length <= 4 ? 0.93 : qClean.length <= 6 ? 0.88 : 0.84;

  for (const word of words) {
    if (word.length < 2) continue;
    if (Math.abs(qClean.length - word.length) > Math.ceil(qClean.length * 0.5)) continue;
    if (jaroWinklerSimilarity(qClean, word) >= jwThreshold) return true;
  }

  // ── Layer C: Levenshtein edit-distance gate ──────────────────────────────
  // Final safety net for longer tokens with the same initial letter/phoneme.
  if (qClean.length >= 4) {
    const [qDmPrimary] = doubleMetaphone(qClean);

    for (const word of words) {
      if (word.length < 4) continue;

      // Same first letter OR same Double Metaphone first character → proceed
      const [wDmPrimary] = doubleMetaphone(word);
      const sameInitial =
        qClean[0] === word[0] ||
        (qDmPrimary && wDmPrimary && qDmPrimary[0] === wDmPrimary[0]);

      if (!sameInitial) continue;

      const maxDist = qClean.length >= 7 ? 2 : 1;
      if (Math.abs(qClean.length - word.length) <= maxDist) {
        if (levenshteinDistance(qClean, word) <= maxDist) return true;
      }
    }
  }

  return false;
};

/* ══════════════════════════════════════════════════════════════════════════════
   6.  createFuseIndex  — Collection-level Fuse.js search (optional utility)
   Use this when you want to search across the full events array with scored,
   ranked results (e.g., building a "search results" page).
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Creates a Fuse.js index over a collection of documents.
 *
 * @param {Array<object>} items — Array of event/document objects to index
 * @param {string[]}      keys  — Fields to search (e.g. ['title', 'category', 'about'])
 * @param {object}        [opts] — Optional Fuse.js option overrides
 * @returns {Fuse} A ready-to-search Fuse instance
 *
 * @example
 * const idx = createFuseIndex(events, ['title', 'category', 'about']);
 * const results = idx.search('komedy');  // [{ item, score, ... }]
 */
export const createFuseIndex = (items, keys, opts = {}) => {
  return new Fuse(items, {
    keys,
    threshold: 0.35,         // 0 = exact match, 1 = match anything
    distance: 100,
    minMatchCharLength: 3,
    includeScore: true,
    useExtendedSearch: false,
    ignoreLocation: true,    // Search entire field, not just prefix
    ...opts,
  });
};
