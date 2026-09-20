import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ROOT = 'android/app/src/main/res';
const SOURCE_ICON = 'public/icon-512x512.png';
const SOURCE_LOGO = 'public/logo.jpeg';

const MIPMAPS = [
  { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
  { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
  { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
  { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
  { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
];

const SPLASHES = [
  { dir: 'drawable', w: 480, h: 800 },
  { dir: 'drawable-port-mdpi', w: 320, h: 480 },
  { dir: 'drawable-port-hdpi', w: 480, h: 800 },
  { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
  { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
];

async function generate() {
  console.log('Generating Android icons and splash assets...');

  // 1. Generate Mipmap Icons
  for (const m of MIPMAPS) {
    const targetDir = path.join(ROOT, m.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.png (square)
    await sharp(SOURCE_ICON)
      .resize(m.size, m.size, { fit: 'cover' })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // ic_launcher_round.png (circular mask)
    const circleSvg = Buffer.from(
      `<svg width="${m.size}" height="${m.size}"><circle cx="${m.size / 2}" cy="${m.size / 2}" r="${m.size / 2}" fill="black"/></svg>`
    );
    await sharp(SOURCE_ICON)
      .resize(m.size, m.size, { fit: 'cover' })
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (safe zone scaled ~65% inside canvas)
    const iconInner = Math.round(m.fgSize * 0.7);
    const innerBuf = await sharp(SOURCE_ICON)
      .resize(iconInner, iconInner, { fit: 'cover' })
      .toBuffer();

    await sharp({
      create: {
        width: m.fgSize,
        height: m.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: innerBuf, gravity: 'center' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated ${m.dir} icons (${m.size}x${m.size})`);
  }

  // 2. Generate Splash Screens with logo centered on dark/brand background
  for (const s of SPLASHES) {
    const targetDir = path.join(ROOT, s.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const logoW = Math.min(Math.round(s.w * 0.55), 600);
    const logoBuf = await sharp(SOURCE_LOGO)
      .resize(logoW, null, { fit: 'inside' })
      .toBuffer();

    await sharp({
      create: {
        width: s.w,
        height: s.h,
        channels: 4,
        background: { r: 0, g: 29, b: 74, alpha: 1 }, // #001D4A brand background
      },
    })
      .composite([{ input: logoBuf, gravity: 'center' }])
      .png()
      .toFile(path.join(targetDir, 'splash.png'));

    console.log(`Generated ${s.dir} splash (${s.w}x${s.h})`);
  }

  console.log('All Android icons and splash screens successfully generated!');
}

generate().catch(console.error);
