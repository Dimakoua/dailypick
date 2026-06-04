(function () {
  'use strict';

  // ==========================================================================
  // LotteryShare — Reusable share image generation for all lottery apps
  //
  // Config shape (all fields optional have sensible defaults):
  //   {
  //     title:        "POWERBILL QUICK PICK",   // header text (uppercase)
  //     subtitle:     "5 from 1–69 + PB 1–26",  // subtitle under header
  //     bonusColor:   "#c0392b",                // accent color for bonus elements
  //     bonusLabel:   "PB",                     // label for bonus ball(s)
  //     bonusCount:   1,                        // 1 or 2 bonus numbers
  //     mainCount:    5,                        // main ball count
  //     appName:      "Powerball",              // used in share text / filename
  //   }
  //
  // Lines shape: [{ main: [5,14,22,48,66], bonus: [11] }, ...]
  //   For bonusCount===2: bonus: [3, 11]
  // ==========================================================================

  function pad(n) { return String(n).padStart(2, '0'); }

  function createRoundedCard(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Lighten a hex color by a factor (0 = original, 1 = white)
  function lighten(hex, factor) {
    const cleaned = hex.replace('#', '');
    const int = parseInt(cleaned.length === 3 ? cleaned.split('').map(c => c + c).join('') : cleaned, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    const lr = Math.round(r + (255 - r) * factor);
    const lg = Math.round(g + (255 - g) * factor);
    const lb = Math.round(b + (255 - b) * factor);
    return `rgb(${lr}, ${lg}, ${lb})`;
  }

  // Darken a hex color by a factor (0 = original, 1 = black)
  function darken(hex, factor) {
    const cleaned = hex.replace('#', '');
    const int = parseInt(cleaned.length === 3 ? cleaned.split('').map(c => c + c).join('') : cleaned, 16);
    const r = Math.round(((int >> 16) & 255) * (1 - factor));
    const g = Math.round(((int >> 8) & 255) * (1 - factor));
    const b = Math.round((int & 255) * (1 - factor));
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Lighten towards white with decimal factor (0-1) — returns rgba string for use in fills/strokes
  function hexToRgba(hex, alpha) {
    const cleaned = hex.replace('#', '').trim();
    const value = cleaned.length === 3
      ? cleaned.split('').map(ch => ch + ch).join('')
      : cleaned;
    const int = parseInt(value, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Build a shareable 1080×1080 canvas image for a lottery quick pick.
   *
   * @param {object} config  - LotteryShare config (title, subtitle, bonusColor, etc.)
   * @param {array}  lines   - Array of { main: number[], bonus: number[] }
   * @returns {HTMLCanvasElement}
   */
  async function createCanvas(config, lines) {
    await document.fonts.ready;

    const W = 1080;
    const H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const bonusColor = config.bonusColor || '#c0392b';
    const accent = lighten(bonusColor, 0.75);       // light tint for bg blobs
    const accentMid = lighten(bonusColor, 0.88);    // subtle card borders
    const headerColor = darken(bonusColor, 0.25);    // header band
    const headerDark = darken(bonusColor, 0.40);     // title text
    const pillBorder = hexToRgba(bonusColor, 0.14);
    const pillBg = lighten(bonusColor, 0.94);

    // --- Background ---
    const bgGradient = ctx.createLinearGradient(0, 0, 0, H);
    bgGradient.addColorStop(0, accent);
    bgGradient.addColorStop(0.45, accentMid);
    bgGradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, W, H);

    // --- Vertical centering: compute content block height ---
    const cardHeight = 108;
    const cardGap = 16;
    const maxLines = Math.min(lines.length, 5);
    const headerBlockH = 190;  // header band (140) + top margin (40) + accent line + spacing (10)
    const footerBlockH = 80;   // footer text + bottom margin
    const linesBlockH = maxLines > 0 ? maxLines * cardHeight + (maxLines - 1) * cardGap : 0;
    const contentH = headerBlockH + linesBlockH + footerBlockH;
    const offsetY = Math.max(20, Math.floor((H - contentH) / 2));

    // Decorative blobs
    const blobAlpha = 0.14;
    ctx.fillStyle = hexToRgba(bonusColor, blobAlpha);
    ctx.beginPath(); ctx.arc(W * 0.15, H * 0.18, 140, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.88, H * 0.22, 120, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hexToRgba(darken(bonusColor, 0.15), 0.10);
    ctx.beginPath(); ctx.arc(W * 0.78, Math.min(H - 60, offsetY + contentH + 40), 170, 0, Math.PI * 2); ctx.fill();

    // --- Header band ---
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    createRoundedCard(ctx, 60, offsetY, W - 120, 140, 28);
    ctx.fill();

    // Accent stripe along top edge of card
    ctx.fillStyle = bonusColor;
    createRoundedCard(ctx, 60, offsetY, W - 120, 6, 3);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = headerDark;
    ctx.font = '800 48px system-ui, sans-serif';
    ctx.fillText((config.title || 'LOTTERY QUICK PICK').toUpperCase(), W / 2, offsetY + 58);

    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillStyle = darken(bonusColor, 0.05);
    ctx.fillText(config.subtitle || '', W / 2, offsetY + 95);

    // Accent line
    ctx.strokeStyle = pillBorder;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(140, offsetY + 115); ctx.lineTo(W - 140, offsetY + 115); ctx.stroke();

    // --- Line cards ---
    const cardStartY = offsetY + 130;

    for (let idx = 0; idx < maxLines; idx++) {
      const line = lines[idx];
      const y = cardStartY + idx * (cardHeight + cardGap);

      // Card background
      createRoundedCard(ctx, 60, y, W - 120, cardHeight, 28);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.fill();
      ctx.strokeStyle = pillBorder;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Line badge
      createRoundedCard(ctx, 74, y + 18, 160, 44, 16);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.strokeStyle = hexToRgba(bonusColor, 0.2);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = headerDark;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Line ${idx + 1}`, 96, y + 46);

      // --- Main number pills ---
      const pillWidth = Math.min(100, (W - 460) / config.mainCount - 10);
      const pillHeight = 58;
      const pillGap = 10;
      const totalPillsWidth = config.mainCount * pillWidth + (config.mainCount - 1) * pillGap;
      const pillXStart = 250;
      const pillYcenter = y + cardHeight / 2;

      for (let p = 0; p < (line.main || []).length; p++) {
        const x = pillXStart + p * (pillWidth + pillGap);
        createRoundedCard(ctx, x, pillYcenter - pillHeight / 2, pillWidth, pillHeight, 18);
        ctx.fillStyle = pillBg;
        ctx.fill();
        ctx.strokeStyle = pillBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = headerDark;
        ctx.font = `700 ${Math.min(26, pillWidth * 0.28)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(pad(line.main[p]), x + pillWidth / 2, pillYcenter + 10);
      }

      // --- Bonus ball(s) ---
      const bonusRightEdge = W - 100;
      const bonusY = y + cardHeight / 2;
      const bonusCount = config.bonusCount || 1;
      const bonusRadius = bonusCount > 1 ? 34 : 42;

      const bonusArr = Array.isArray(line.bonus) ? line.bonus : [line.bonus];

      for (let b = 0; b < bonusCount; b++) {
        const bx = bonusRightEdge - b * (bonusRadius * 2 + 16);
        ctx.beginPath();
        ctx.arc(bx, bonusY, bonusRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = bonusColor;
        ctx.stroke();

        ctx.fillStyle = bonusColor;
        ctx.font = `700 ${bonusRadius * 0.73}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(pad(bonusArr[b] || 0), bx, bonusY + bonusRadius * 0.33);

        if (bonusCount > 1) {
          ctx.fillStyle = darken(bonusColor, 0.05);
          ctx.font = '600 14px system-ui, sans-serif';
          ctx.fillText(config.bonusLabel || '', bx, bonusY + bonusRadius + 20);
        }
      }

      if (bonusCount === 1) {
        ctx.fillStyle = darken(bonusColor, 0.05);
        ctx.font = '600 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(config.bonusLabel || '', bonusRightEdge, bonusY + bonusRadius + 28);
      }
    }

    // --- Footer ---
    const footerY = offsetY + headerBlockH + linesBlockH + 50;
    const appName = config.appName || 'Lottery';
    const footerUrl = config.shareUrl || 'dailypick.dev';
    ctx.textAlign = 'center';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(52, 73, 94, 0.6)';
    ctx.fillText(footerUrl, W / 2, footerY);

    return canvas;
  }

  /**
   * Generate share text for social / clipboard.
   */
  function getShareText(config, lines) {
    if (!lines || !lines.length) {
      return `${config.appName || 'Lottery'} quick pick from Daily Pick.`;
    }
    const fmt = (line) => {
      const main = (line.main || []).map(pad).join(' ');
      const bonusArr = Array.isArray(line.bonus) ? line.bonus : [line.bonus];
      const bonus = bonusArr.map(pad).join(' ');
      return `${main} + ${config.bonusLabel || 'B'} ${bonus}`;
    };
    const name = config.appName || 'Lottery';
    return `${name} quick pick: ${lines.map(fmt).join(' / ')}.`;
  }

  /**
   * Generate filename for download.
   */
  function getFileName(config) {
    const date = new Date().toISOString().slice(0, 10);
    const slug = (config.appName || 'Lottery').replace(/\s+/g, '-');
    return `${slug}-Quick-Pick-${date}.png`;
  }

  window.LotteryShare = {
    createCanvas,
    getShareText,
    getFileName,
  };
}());
