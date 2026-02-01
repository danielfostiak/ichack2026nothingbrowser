const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

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

  // Copy Amazon boring-modules (templates + injectors)
  const srcModules = path.join(__dirname, 'src/amazon/ICHack2026/boring-modules');
  const distModules = path.join(__dirname, 'dist/boring-modules');
  copyDir(srcModules, distModules);
  console.log('✓ Boring modules copied');

  // Copy videoplayback.mp4
  const srcVideo = path.join(__dirname, 'assets/videoplayback.mp4');
  const distVideo = path.join(__dirname, 'dist/videoplayback.mp4');
  if (fs.existsSync(srcVideo)) {
    fs.copyFileSync(srcVideo, distVideo);
    console.log('✓ Video file copied');
  } else {
    console.warn('⚠ Video file not found at assets/videoplayback.mp4');
  }

  console.log('\nBuild successful! Run "npm start" to launch the browser.');
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
