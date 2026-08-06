/**
 * qrGenerator.js
 * Pure JavaScript QR Code Generator - Zero external dependencies.
 * Renders QR codes to an HTML5 canvas element.
 *
 * Usage:
 *   drawQRCode(canvasElement, 'your-data', { ecLevel: 'H', quiet: 2, fgColor: '#000', bgColor: '#fff' })
 *
 * Supports: Byte mode, Versions 1-10, Error-correction levels L / M / Q / H
 */

// === GF(256) Galois Field =================================================
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function () {
  let v = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = v;
    GF_LOG[v]  = i;
    v = (v << 1) ^ (v & 0x80 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a, b) => (a && b) ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0;

// === Reed-Solomon Generator Polynomial (cached) ===========================
const _genCache = {};

function makeGenPoly(degree) {
  if (_genCache[degree]) return _genCache[degree];
  // Build G(x) = product(x + alpha^i) for i = 0 to degree-1
  // Coefficients in DESCENDING degree order: [g_n, g_{n-1}, ..., g_0]
  let g = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const root = GF_EXP[i];
    const ng   = new Uint8Array(g.length + 1);
    for (let j = 0; j < g.length; j++) {
      ng[j]     ^= g[j];
      ng[j + 1] ^= gfMul(g[j], root);
    }
    g = ng;
  }
  _genCache[degree] = g;
  return g;
}

function computeECC(data, eccLen) {
  const gen = makeGenPoly(eccLen);
  const rem = new Uint8Array(eccLen);
  for (const b of data) {
    const lead = b ^ rem[0];
    rem.copyWithin(0, 1);
    rem[eccLen - 1] = 0;
    for (let i = 0; i < eccLen; i++) rem[i] ^= gfMul(gen[i + 1], lead);
  }
  return rem;
}

// === QR Parameters =========================================================
const QR_PARAMS = [
  { L:[7,1,19,0,0],   M:[10,1,16,0,0],  Q:[13,1,13,0,0],   H:[17,1,9,0,0]   }, // v1
  { L:[10,1,34,0,0],  M:[16,1,28,0,0],  Q:[22,1,22,0,0],   H:[28,1,16,0,0]  }, // v2
  { L:[15,1,55,0,0],  M:[26,1,44,0,0],  Q:[18,2,17,0,0],   H:[22,2,13,0,0]  }, // v3
  { L:[20,1,80,0,0],  M:[18,2,32,0,0],  Q:[26,2,24,0,0],   H:[16,4,9,0,0]   }, // v4
  { L:[26,1,108,0,0], M:[24,2,43,0,0],  Q:[18,2,15,2,16],  H:[22,2,11,2,12] }, // v5
  { L:[18,2,68,0,0],  M:[16,4,27,0,0],  Q:[24,4,19,0,0],   H:[28,4,15,0,0]  }, // v6
  { L:[20,2,78,0,0],  M:[18,4,31,0,0],  Q:[18,2,14,4,15],  H:[26,4,13,1,14] }, // v7
  { L:[24,2,97,0,0],  M:[22,2,38,2,39], Q:[22,4,18,2,19],  H:[26,4,14,2,15] }, // v8
  { L:[30,2,116,0,0], M:[22,3,36,2,37], Q:[20,4,16,4,17],  H:[24,4,12,4,13] }, // v9
  { L:[18,2,68,2,69], M:[26,4,43,1,44], Q:[24,6,19,2,20],  H:[28,6,15,2,16] }, // v10
];

// Max byte capacity [version-1] x [L, M, Q, H]
const BYTE_CAP = [
  [17,14,11,7],   [32,26,20,14],  [53,44,32,24],   [78,64,46,34],
  [106,86,60,44], [134,108,74,58],[154,124,90,64],  [192,154,110,84],
  [230,182,132,98],[271,216,154,119],
];

const EC_IND    = { L:1, M:0, Q:3, H:2 };
const REMAINDER = [0,7,7,7,7,7,0,0,0,0]; // remainder bits per version

// Alignment pattern row/col sets per version (index 0 = v1)
const ALIGN_POS = [
  [],          [6,18],   [6,22],   [6,26],   [6,30],
  [6,34],      [6,22,38],[6,24,42],[6,26,46],[6,28,50],
];

// Pre-computed 18-bit version info words (v7+)
const VERSION_INFO = { 7:0x07C94, 8:0x085BC, 9:0x09A99, 10:0x0A4D3 };

// === Build Codewords =======================================================
function buildCodewords(text, version, ecLevel) {
  const [eccN, g1n, g1d, g2n, g2d] = QR_PARAMS[version - 1][ecLevel];
  const totalData = g1n * g1d + g2n * g2d;

  const bytes = [];
  for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 0xff);

  const rawBits = [];
  const push = (val, n) => { for (let i = n-1; i >= 0; i--) rawBits.push((val >> i) & 1); };

  push(0x4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  for (let i = 0; i < 4 && rawBits.length < totalData * 8; i++) rawBits.push(0);
  while (rawBits.length & 7) rawBits.push(0);

  const PAD = [0xec, 0x11];
  for (let pi = 0; rawBits.length < totalData * 8; pi++) push(PAD[pi & 1], 8);

  const dataBytes = [];
  for (let i = 0; i < totalData; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (rawBits[i * 8 + j] || 0);
    dataBytes.push(b);
  }

  const dBlocks = [], eBlocks = [];
  let pos = 0;
  for (let i = 0; i < g1n; i++) {
    const blk = dataBytes.slice(pos, pos + g1d); pos += g1d;
    dBlocks.push(blk); eBlocks.push([...computeECC(blk, eccN)]);
  }
  for (let i = 0; i < g2n; i++) {
    const blk = dataBytes.slice(pos, pos + g2d); pos += g2d;
    dBlocks.push(blk); eBlocks.push([...computeECC(blk, eccN)]);
  }

  const codewords = [];
  const maxD = Math.max(g1d, g2d);
  for (let i = 0; i < maxD; i++) for (const blk of dBlocks) if (i < blk.length) codewords.push(blk[i]);
  for (let i = 0; i < eccN; i++)  for (const blk of eBlocks) codewords.push(blk[i]);

  return codewords;
}

// === Matrix Initialisation =================================================
function initMatrix(version) {
  const size     = version * 4 + 17;
  const modules  = new Int16Array(size * size).fill(-1);
  const reserved = new Uint8Array(size * size);

  const I = (r, c) => r * size + c;

  function setFn(r, c, dark) {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[I(r, c)]  = dark ? 1 : 0;
    reserved[I(r, c)] = 1;
  }

  function drawFinder(or, oc) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const dark = r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4);
          setFn(or+r, oc+c, dark);
        } else {
          setFn(or+r, oc+c, false);
        }
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  setFn(size - 8, 8, true);

  const aligns = ALIGN_POS[version - 1];
  for (let i = 0; i < aligns.length; i++) {
    for (let j = 0; j < aligns.length; j++) {
      const cr = aligns[i], cc = aligns[j];
      if (reserved[I(cr, cc)]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.abs(dr)===2||Math.abs(dc)===2||(dr===0&&dc===0);
          setFn(cr+dr, cc+dc, dark);
        }
      }
    }
  }

  function reserveCell(r, c) {
    if (r<0||r>=size||c<0||c>=size) return;
    if (!reserved[I(r,c)]) { modules[I(r,c)]=0; reserved[I(r,c)]=1; }
  }
  for (let i = 0; i <= 8; i++) { reserveCell(8,i); reserveCell(i,8); }
  for (let i = size-8; i < size; i++) { reserveCell(8,i); reserveCell(i,8); }

  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = size-11; j <= size-9; j++) {
        reserveCell(i,j); reserveCell(j,i);
      }
    }
  }

  return { modules, reserved, size };
}

// === Place Data (zigzag) ===================================================
function placeData(matrix, codewords, version) {
  const { modules, reserved, size } = matrix;
  const I = (r, c) => r * size + c;

  const bits = [];
  for (const cw of codewords) for (let b = 7; b >= 0; b--) bits.push((cw >> b) & 1);
  for (let i = 0; i < REMAINDER[version - 1]; i++) bits.push(0);

  let bitIdx = 0, upward = true;
  for (let col = size-1; col >= 1; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = upward ? size-1-i : i;
      for (let dc = 0; dc <= 1; dc++) {
        const c = col - dc;
        if (!reserved[I(row, c)]) modules[I(row, c)] = bitIdx < bits.length ? bits[bitIdx++] : 0;
      }
    }
    upward = !upward;
  }
}

// === Masking ===============================================================
const MASK_FNS = [
  (r,c) => (r+c)%2===0,
  (r,c) => r%2===0,
  (r,c) => c%3===0,
  (r,c) => (r+c)%3===0,
  (r,c) => (Math.floor(r/2)+Math.floor(c/3))%2===0,
  (r,c) => (r*c)%2+(r*c)%3===0,
  (r,c) => ((r*c)%2+(r*c)%3)%2===0,
  (r,c) => ((r+c)%2+(r*c)%3)%2===0,
];

function applyMask(modules, reserved, size, maskIdx) {
  const fn   = MASK_FNS[maskIdx];
  const copy = Int16Array.from(modules);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      if (!reserved[i] && fn(r, c)) copy[i] ^= 1;
    }
  return copy;
}

// === Format Information ===================================================
function calcFormatBits(ecLevel, maskIdx) {
  const data = (EC_IND[ecLevel] << 3) | maskIdx;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if (rem & (1 << i)) rem ^= 0x537 << (i - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

function writeFormatInfo(modules, size, ecLevel, maskIdx) {
  const bits = calcFormatBits(ecLevel, maskIdx);
  const loc1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const loc2 = [[8,size-1],[8,size-2],[8,size-3],[8,size-4],[8,size-5],[8,size-6],[8,size-7],[size-8,8],[size-7,8],[size-6,8],[size-5,8],[size-4,8],[size-3,8],[size-2,8],[size-1,8]];
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> (14-i)) & 1;
    modules[loc1[i][0]*size+loc1[i][1]] = bit;
    modules[loc2[i][0]*size+loc2[i][1]] = bit;
  }
  modules[(size-8)*size+8] = 1;
}

function writeVersionInfo(modules, size, version) {
  const info = VERSION_INFO[version];
  if (!info) return;
  for (let i = 0; i < 18; i++) {
    const bit = (info >> i) & 1;
    const r = Math.floor(i/3), c = i%3;
    modules[r*size+(size-11+c)] = bit;
    modules[(size-11+c)*size+r] = bit;
  }
}

// === Penalty Scoring =======================================================
function calcPenalty(modules, size) {
  const m = (r,c) => modules[r*size+c];
  let score = 0;

  for (let r = 0; r < size; r++) {
    let rn=1, cn=1;
    for (let c = 1; c < size; c++) {
      if (m(r,c)===m(r,c-1)){rn++;if(rn===5)score+=3;else if(rn>5)score++;}else rn=1;
      if (m(c,r)===m(c-1,r)){cn++;if(cn===5)score+=3;else if(cn>5)score++;}else cn=1;
    }
  }

  for (let r = 0; r < size-1; r++)
    for (let c = 0; c < size-1; c++) {
      const s=m(r,c)+m(r,c+1)+m(r+1,c)+m(r+1,c+1);
      if (s===0||s===4) score+=3;
    }

  const P1=[1,0,1,1,1,0,1,0,0,0,0], P2=[0,0,0,0,1,0,1,1,1,0,1];
  for (let r=0; r<size; r++) for (let c=0; c<=size-11; c++) {
    let rM1=true,rM2=true,cM1=true,cM2=true;
    for (let k=0; k<11; k++) {
      if(m(r,c+k)!==P1[k])rM1=false; if(m(r,c+k)!==P2[k])rM2=false;
      if(m(c+k,r)!==P1[k])cM1=false; if(m(c+k,r)!==P2[k])cM2=false;
    }
    if(rM1||rM2)score+=40; if(cM1||cM2)score+=40;
  }

  let dark=0;
  for (let i=0; i<size*size; i++) if(modules[i]===1) dark++;
  score += Math.floor(Math.abs(dark*100/(size*size)-50)/5)*10;

  return score;
}

// === Public API ============================================================
export function drawQRCode(canvas, text, opts = {}) {
  const ecLevel = opts.ecLevel || 'H';
  const quiet   = opts.quiet   !== undefined ? opts.quiet : 2;
  const fgColor = opts.fgColor || '#000000';
  const bgColor = opts.bgColor || '#FFFFFF';

  const ecIdx = { L:0, M:1, Q:2, H:3 }[ecLevel];
  let version = 1;
  while (version <= 10 && BYTE_CAP[version-1][ecIdx] < text.length) version++;
  if (version > 10) throw new Error('Data too long - max 10 QR versions supported.');

  const codewords = buildCodewords(text, version, ecLevel);
  const matrix    = initMatrix(version);
  const { reserved, size } = matrix;

  placeData(matrix, codewords, version);

  let bestMask=0, bestScore=Infinity;
  for (let mask=0; mask<8; mask++) {
    const masked = applyMask(matrix.modules, reserved, size, mask);
    writeFormatInfo(masked, size, ecLevel, mask);
    if (version >= 7) writeVersionInfo(masked, size, version);
    const score = calcPenalty(masked, size);
    if (score < bestScore) { bestScore=score; bestMask=mask; }
  }

  const finalModules = applyMask(matrix.modules, reserved, size, bestMask);
  writeFormatInfo(finalModules, size, ecLevel, bestMask);
  if (version >= 7) writeVersionInfo(finalModules, size, version);

  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const displaySize = typeof opts.size === 'number' ? opts.size : (canvas.clientWidth || canvas.width || 200);
  const actualSize = displaySize * dpr;

  canvas.width  = actualSize;
  canvas.height = actualSize;

  const totalGrid = size + 2 * quiet;
  const modSize = actualSize / totalGrid;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, actualSize, actualSize);

  ctx.fillStyle = fgColor;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (finalModules[r * size + c] === 1) {
        const x = Math.floor((c + quiet) * modSize);
        const y = Math.floor((r + quiet) * modSize);
        const w = Math.ceil((c + quiet + 1) * modSize) - x;
        const h = Math.ceil((r + quiet + 1) * modSize) - y;
        ctx.fillRect(x, y, w, h);
      }
    }
  }
}

