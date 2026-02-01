const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Build TypeScript files
esbuild.build({
  entryPoints: ['src/main.ts', 'src/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outdir: 'dist',
  external: ['electron']
}).then(() => {
  console.log('✓ TypeScript build complete');

  // Copy CSS file
  const srcCss = path.join(__dirname, 'src/ui/styles.css');
  const distUi = path.join(__dirname, 'dist/ui');
  const distCss = path.join(distUi, 'styles.css');

  if (!fs.existsSync(distUi)) {
    fs.mkdirSync(distUi, { recursive: true });
  }

  fs.copyFileSync(srcCss, distCss);
  console.log('✓ CSS file copied');

  // Copy homepage.html
  const srcHtml = path.join(__dirname, 'src/homepage.html');
  const distHtml = path.join(__dirname, 'dist/homepage.html');
  fs.copyFileSync(srcHtml, distHtml);
  console.log('✓ Homepage HTML copied');

  // Copy video files
  const videoFiles = ['videoplayback.mp4', 'rat.mp4', 'elon.mp4'];
  let videoCount = 0;
  videoFiles.forEach(filename => {
    const srcVideo = path.join(__dirname, 'assets', filename);
    const distVideo = path.join(__dirname, 'dist', filename);
    if (fs.existsSync(srcVideo)) {
      fs.copyFileSync(srcVideo, distVideo);
      videoCount++;
    }
  });

  if (videoCount > 0) {
    console.log(`✓ ${videoCount} video file(s) copied`);
  } else {
    console.warn('⚠ No video files found in assets/');
  }

  // Copy ASOS shoe images
  const assetsDir = path.join(__dirname, 'assets');
  const distAssetsDir = path.join(__dirname, 'dist/assets');

  if (!fs.existsSync(distAssetsDir)) {
    fs.mkdirSync(distAssetsDir, { recursive: true });
  }

  let asosImageCount = 0;
  for (let i = 1; i <= 8; i++) {
    const srcImg = path.join(assetsDir, `asos-shoe-${i}.jpg`);
    const distImg = path.join(distAssetsDir, `asos-shoe-${i}.jpg`);
    if (fs.existsSync(srcImg)) {
      fs.copyFileSync(srcImg, distImg);
      asosImageCount++;
    }
  }

  if (asosImageCount > 0) {
    console.log(`✓ ${asosImageCount} ASOS product images copied`);
  } else {
    console.warn('⚠ No ASOS product images found - add images to assets/asos-shoe-*.jpg');
  }

  console.log('\nBuild successful! Run "npm start" to launch the browser.');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
