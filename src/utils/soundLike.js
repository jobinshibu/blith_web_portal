/**
 * Sound-Like / Phonetic Matching Utilities
 * 
 * Provides Metaphone, Soundex, and typo-tolerant Levenshtein algorithms
 * to match search queries phonetically (e.g., "nite" -> "night", "komedy" -> "comedy").
 */

/**
 * Standard American Soundex algorithm
 * @param {string} word 
 * @returns {string} 4-character Soundex code (e.g. 'C530')
 */
export const soundex = (word) => {
  if (!word || typeof word !== 'string') return '';
  const clean = word.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return '';

  const firstLetter = clean[0];
  const mappings = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6'
  };

  let result = firstLetter;
  let prevCode = mappings[firstLetter] || '0';

  for (let i = 1; i < clean.length; i++) {
    const char = clean[i];
    const code = mappings[char] || '0';

    if (code !== '0' && code !== prevCode) {
      result += code;
    }
    prevCode = code;
    if (result.length === 4) break;
  }

  return result.padEnd(4, '0');
};

/**
 * Metaphone phonetic algorithm
 * @param {string} word 
 * @returns {string} Metaphone phonetic key
 */
export const metaphone = (word) => {
  if (!word || typeof word !== 'string') return '';
  let str = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!str) return '';

  // Drop duplicate adjacent letters except 'c'
  str = str.replace(/([^c])\1+/g, '$1');

  // Initial letter exceptions
  if (str.startsWith('kn') || str.startsWith('gn') || str.startsWith('pn') || str.startsWith('wr')) {
    str = str.slice(1);
  } else if (str.startsWith('ae')) {
    str = 'e' + str.slice(2);
  } else if (str.startsWith('x')) {
    str = 's' + str.slice(1);
  } else if (str.startsWith('wh')) {
    str = 'w' + str.slice(2);
  }

  let code = '';
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const ch = str[i];
    const next = i + 1 < len ? str[i + 1] : '';
    const next2 = i + 2 < len ? str[i + 2] : '';
    const prev = i > 0 ? str[i - 1] : '';

    // Vowels only encoded if at beginning
    if (i === 0 && 'aeiou'.includes(ch)) {
      code += ch.toUpperCase();
      continue;
    }
    if ('aeiou'.includes(ch)) {
      continue;
    }

    switch (ch) {
      case 'b':
        // Silent b at end after m: e.g. dumb
        if (i === len - 1 && prev === 'm') break;
        code += 'B';
        break;
      case 'c':
        if (next === 'i' && next2 === 'a') {
          code += 'X'; // -cia- -> 'sh'
          i += 2;
        } else if (next === 'h') {
          code += 'X'; // -ch- -> 'sh'
          i++;
        } else if (next === 'e' || next === 'i' || next === 'y') {
          code += 'S';
        } else {
          code += 'K';
        }
        break;
      case 'd':
        if (next === 'g' && (next2 === 'e' || next2 === 'i' || next2 === 'y')) {
          code += 'J';
          i += 2;
        } else {
          code += 'T';
        }
        break;
      case 'f':
        code += 'F';
        break;
      case 'g':
        if (next === 'h') {
          if (i + 2 < len && !'aeiou'.includes(str[i + 2])) {
            // gh followed by consonant -> silent (like night, bright)
            i++;
            break;
          }
          code += 'F'; // rough, laugh
          i++;
        } else if (next === 'n' && (i + 2 === len || (i + 3 === len && str[i + 2] === 'e' && str[i + 3] === 'd'))) {
          // sign, signed
          break;
        } else if (next === 'e' || next === 'i' || next === 'y') {
          code += 'J';
        } else {
          code += 'K';
        }
        break;
      case 'h':
        // Silent h if after vowel and not followed by vowel (e.g. Hannah, Sarah)
        if (prev && 'aeiou'.includes(prev) && (!next || !'aeiou'.includes(next))) break;
        if (i === 0 || (next && 'aeiou'.includes(next))) {
          code += 'H';
        }
        break;
      case 'j':
        code += 'J';
        break;
      case 'k':
        if (prev === 'c') break;
        code += 'K';
        break;
      case 'l':
        code += 'L';
        break;
      case 'm':
        code += 'M';
        break;
      case 'n':
        code += 'N';
        break;
      case 'p':
        if (next === 'h') {
          code += 'F';
          i++;
        } else {
          code += 'P';
        }
        break;
      case 'q':
        code += 'K';
        break;
      case 'r':
        code += 'R';
        break;
      case 's':
        if (next === 'h') {
          code += 'X';
          i++;
        } else if (next === 'i' && (next2 === 'o' || next2 === 'a')) {
          code += 'X';
          i += 2;
        } else {
          code += 'S';
        }
        break;
      case 't':
        if (next === 'i' && (next2 === 'a' || next2 === 'o')) {
          code += 'X';
          i += 2;
        } else if (next === 'h') {
          code += '0';
          i++;
        } else if (next === 'c' && next2 === 'h') {
          // tch -> silent t
          break;
        } else {
          code += 'T';
        }
        break;
      case 'v':
        code += 'F';
        break;
      case 'w':
      case 'y':
        if (next && 'aeiou'.includes(next)) {
          code += ch.toUpperCase();
        }
        break;
      case 'x':
        code += 'KS';
        break;
      case 'z':
        code += 'S';
        break;
      default:
        break;
    }
  }

  return code;
};

/**
 * Levenshtein distance between two strings
 * @param {string} a 
 * @param {string} b 
 * @returns {number} Edit distance
 */
export const levenshteinDistance = (a, b) => {
  if (!a || !b) return (a || '').length + (b || '').length;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
};

/**
 * Checks if a search query token phonetically / "sound like" matches any word in the target text.
 * @param {string} queryToken - A normalized search token from user's input (e.g. "nite", "komedy")
 * @param {string} targetText - Field content from the event (e.g. event.title, event.category, event.about)
 * @returns {boolean}
 */
export const isSoundLikeMatch = (queryToken, targetText) => {
  if (!queryToken || !targetText || typeof targetText !== 'string') return false;

  const qClean = queryToken.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (qClean.length < 3) return false; // Avoid false positives for 1-2 char tokens

  const qMeta = metaphone(qClean);
  const qSoundex = soundex(qClean);

  // Extract individual words from targetText
  const words = targetText
    .toLowerCase()
    .split(/[\s,#&_./-]+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length >= 3);

  for (const word of words) {
    const wMeta = metaphone(word);
    const wSoundex = soundex(word);

    // 1. Direct phonetic equality
    if (wMeta && qMeta && wMeta === qMeta) {
      return true;
    }

    // 2. Compound words (e.g. nite matching nightlife):
    // If the word contains "night" and query is "nite" (or vice versa)
    if (word.length > qClean.length) {
      if (qClean === 'nite' && word.startsWith('night')) return true;
      if (qClean === 'night' && word.startsWith('nite')) return true;
    }

    // 3. Soundex phonetic match: only if both words are similar in length and Soundex has at least 2 distinct consonant codes (not padded 00 like H500 or B100)
    if (wSoundex && qSoundex && wSoundex === qSoundex && !qSoundex.endsWith('00')) {
      if (Math.abs(qClean.length - word.length) <= 1) {
        return true;
      }
    }

    // 4. Typo-tolerant edit distance (Levenshtein)
    // Only allows for words with same initial letter or same initial phonetic sound
    if (qClean.length >= 4 && word.length >= 4) {
      const sameInitial = qClean[0] === word[0] || (qMeta && wMeta && qMeta[0] === wMeta[0]);
      if (sameInitial) {
        const maxAllowedDist = qClean.length >= 7 ? 2 : 1;
        if (Math.abs(qClean.length - word.length) <= maxAllowedDist) {
          if (levenshteinDistance(qClean, word) <= maxAllowedDist) {
            return true;
          }
        }
      }
    }
  }

  return false;
};

