// ==================== CHANGED: PERFORMANCE OPTIMIZATION ====================
import React, { useEffect, useRef, memo } from 'react';
import { drawQRCode } from './qrGenerator';

/**
 * QRCodeCanvas - Drop-in replacement for qrcode.react's QRCodeSVG.
 * Accepts the same props. Renders to a <canvas> element using
 * the local pure-JS QR generator — zero external dependencies.
 */
const QRCodeCanvas = memo(function QRCodeCanvas({
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

    const frameId = requestAnimationFrame(() => {
      try {
        if (canvasRef.current) {
          drawQRCode(canvasRef.current, value, {
            ecLevel : level,
            size,
            quiet   : includeMargin ? 4 : 2,
            fgColor,
            bgColor,
          });
        }
      } catch (err) {
        console.error('[QRCodeCanvas] QR generation failed:', err);
      }
    });

    return () => cancelAnimationFrame(frameId);
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
});

export default QRCodeCanvas;

