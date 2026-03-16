const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// SVG source
// ---------------------------------------------------------------------------

const ICON_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="ballGrad" cx="38%" cy="35%" r="55%" fx="38%" fy="35%">
      <stop offset="0%" stop-color="#00E8E2"/>
      <stop offset="55%" stop-color="#00CEC9"/>
      <stop offset="100%" stop-color="#008F8B"/>
    </radialGradient>
    <mask id="mMask">
      <rect width="1024" height="1024" fill="white"/>
      <g transform="translate(512, 545)">
        <path d="
          M-155,105 L-155,-15
          Q-155,-88 -105,-88
          Q-55,-88 -45,-15
          L-45,-15
          Q-45,-88 5,-88
          Q55,-88 65,-15
          L65,-15
          Q65,-88 115,-88
          Q165,-88 165,-15
          L165,105
        " stroke="black" stroke-width="44" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </mask>
    <radialGradient id="holeGrad" cx="40%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#006663"/>
      <stop offset="100%" stop-color="#004442"/>
    </radialGradient>
    <filter id="holeShadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#003330" flood-opacity="0.6"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="#0C0C0C"/>
  <circle cx="512" cy="512" r="340" fill="url(#ballGrad)" mask="url(#mMask)"/>
  <ellipse cx="390" cy="370" rx="130" ry="90" fill="white" opacity="0.08" transform="rotate(-25, 390, 370)" mask="url(#mMask)"/>
  <ellipse cx="420" cy="400" rx="50" ry="35" fill="white" opacity="0.05" transform="rotate(-25, 420, 400)" mask="url(#mMask)"/>
  <g filter="url(#holeShadow)">
    <ellipse cx="470" cy="340" rx="26" ry="28" fill="url(#holeGrad)" transform="rotate(-8, 470, 340)"/>
    <ellipse cx="468" cy="337" rx="18" ry="20" fill="#003B38" transform="rotate(-8, 468, 337)"/>
    <ellipse cx="555" cy="330" rx="26" ry="28" fill="url(#holeGrad)" transform="rotate(5, 555, 330)"/>
    <ellipse cx="553" cy="327" rx="18" ry="20" fill="#003B38" transform="rotate(5, 553, 327)"/>
    <ellipse cx="515" cy="420" rx="24" ry="27" fill="url(#holeGrad)" transform="rotate(-2, 515, 420)"/>
    <ellipse cx="514" cy="417" rx="16" ry="19" fill="#003B38" transform="rotate(-2, 514, 417)"/>
  </g>
  <circle cx="512" cy="512" r="338" fill="none" stroke="white" stroke-width="1" opacity="0.04" mask="url(#mMask)"/>
</svg>`;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'images');
const SVG_TMP    = path.join(__dirname, 'icon_src.svg');
const ICON_OUT   = path.join(ASSETS_DIR, 'icon.png');
const SPLASH_OUT = path.join(ASSETS_DIR, 'splash.png');

// ---------------------------------------------------------------------------
// Step 1 — icon.png  (1024 × 1024)
// ---------------------------------------------------------------------------

async function genIcon() {
  fs.writeFileSync(SVG_TMP, ICON_SVG, 'utf8');

  await sharp(Buffer.from(ICON_SVG))
    .resize(1024, 1024)
    .png()
    .toFile(ICON_OUT);

  const { width, height, size } = await sharp(ICON_OUT).metadata();
  console.log(`icon.png  → ${width}×${height}  (${(size / 1024).toFixed(1)} KB)`);
}

// ---------------------------------------------------------------------------
// Step 2 — splash.png  (1284 × 2778, ball scaled to 300px wide, centered)
// ---------------------------------------------------------------------------

async function genSplash() {
  const W = 1284;
  const H = 2778;
  const BALL_SIZE = 300;

  // Render ball at 300px
  const ballPng = await sharp(Buffer.from(ICON_SVG))
    .resize(BALL_SIZE, BALL_SIZE)
    .png()
    .toBuffer();

  // Dark background canvas
  const bg = await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 12, g: 12, b: 12, alpha: 1 }, // #0C0C0C
    },
  })
    .png()
    .toBuffer();

  // Composite ball centered
  const left = Math.round((W - BALL_SIZE) / 2);
  const top  = Math.round((H - BALL_SIZE) / 2);

  await sharp(bg)
    .composite([{ input: ballPng, left, top }])
    .png()
    .toFile(SPLASH_OUT);

  const { width, height, size } = await sharp(SPLASH_OUT).metadata();
  console.log(`splash.png → ${width}×${height}  (${(size / 1024).toFixed(1)} KB)`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

(async () => {
  try {
    await genIcon();
    await genSplash();
    // Clean up temp SVG
    if (fs.existsSync(SVG_TMP)) fs.unlinkSync(SVG_TMP);
    console.log('Done. Open assets/images/ to verify.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
