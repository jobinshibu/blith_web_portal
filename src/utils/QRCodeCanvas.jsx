import React, { useEffect, useRef } from 'react';
import { drawQRCode } from './qrGenerator';

/**
 * QRCodeCanvas - Drop-in replacement for qrcode.react's QRCodeSVG.
 * Accepts the same props. Renders to a <canvas> element using
 * the local pure-JS QR generator — zero external dependencies.
 *
 * Props:
 *   value        {string}  - Data to encode
 *   size         {number}  - Pixel size of the canvas (default 140)
 *   bgColor      {string}  - Background colour (default '#FFFFFF')
 *   fgColor      {string}  - Foreground / dark module colour (default '#000000')
 *   level        {string}  - Error-correction level: 'L' | 'M' | 'Q' | 'H' (default 'H')
 *   includeMargin {boolean} - Add a quiet zone around the QR code (default false)
 *   style        {object}  - Inline styles applied to the canvas
 */
function QRCodeCanvas({
  value        = '',
  size         = 140,
  bgColor      = '#FFFFFF',
  fgColor      = '#000000',
  level        = 'H',
  includeMargin = false,
  style        = {},
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    try {
      drawQRCode(canvasRef.current, value, {
        ecLevel : level,
        size,
        quiet   : includeMargin ? 4 : 2,
        fgColor,
        bgColor,
      });
    } catch (err) {
      console.error('[QRCodeCanvas] QR generation failed:', err);
    }
  }, [value, size, bgColor, fgColor, level, includeMargin]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: 'block', ...style }}
      aria-label="QR Code"
    />
  );
}

export default QRCodeCanvas;
