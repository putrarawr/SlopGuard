import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');
const isDev = process.argv.includes('--dev');

/**
 * Build SlopGuard Chrome Extension.
 * 
 * Builds each entry point independently as IIFE (self-contained, no imports).
 * This is the only reliable way to produce single-file bundles for Chrome Extension
 * content scripts and service workers.
 */
async function buildExtension() {
  console.log('[SlopGuard] Building extension...\n');

  // Clean dist
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Build Service Worker (IIFE, self-contained)
  console.log('[1/4] Building service-worker.js ...');
  await build({
    configFile: false,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      sourcemap: isDev ? 'inline' : false,
      minify: !isDev,
      target: 'esnext',
      lib: {
        entry: resolve(__dirname, 'src/background/service-worker.js'),
        formats: ['iife'],
        name: 'SlopGuardSW',
        fileName: () => 'service-worker.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    logLevel: 'warn',
  });

  // 2. Build Content Script (IIFE, self-contained)
  console.log('[2/4] Building content.js ...');
  await build({
    configFile: false,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      sourcemap: isDev ? 'inline' : false,
      minify: !isDev,
      target: 'esnext',
      lib: {
        entry: resolve(__dirname, 'src/content/content.js'),
        formats: ['iife'],
        name: 'SlopGuardContent',
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          // CSS dari content.css?inline sudah di-handle oleh Vite
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
    logLevel: 'warn',
  });

  // 3. Build Popup (standard HTML build)
  console.log('[3/4] Building popup ...');
  await build({
    configFile: false,
    root: resolve(__dirname, 'src/popup'),
    base: './',
    build: {
      outDir: resolve(distDir, 'popup'),
      emptyOutDir: false,
      sourcemap: isDev ? 'inline' : false,
      minify: !isDev,
      target: 'esnext',
      rollupOptions: {
        input: resolve(__dirname, 'src/popup/popup.html'),
        output: {
          entryFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          // Inline shared modules
          manualChunks: undefined,
        },
      },
    },
    logLevel: 'warn',
  });

  // 4. Build Options Page (standard HTML build)
  console.log('[4/4] Building options ...');
  await build({
    configFile: false,
    root: resolve(__dirname, 'src/options'),
    base: './',
    build: {
      outDir: resolve(distDir, 'options'),
      emptyOutDir: false,
      sourcemap: isDev ? 'inline' : false,
      minify: !isDev,
      target: 'esnext',
      rollupOptions: {
        input: resolve(__dirname, 'src/options/options.html'),
        output: {
          entryFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          manualChunks: undefined,
        },
      },
    },
    logLevel: 'warn',
  });

  // 5. Copy manifest.json (adjusted paths)
  console.log('\n[Post] Copying manifest.json and icons...');
  const manifest = JSON.parse(fs.readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));

  // Update paths for our build structure
  manifest.action.default_popup = 'popup/popup.html';
  manifest.options_page = 'options/options.html';
  // Service worker is IIFE, not module
  delete manifest.background.type;

  fs.writeFileSync(
    resolve(distDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // 6. Copy icons
  const iconsDir = resolve(__dirname, 'src/assets/icons');
  const distIconsDir = resolve(distDir, 'icons');
  fs.mkdirSync(distIconsDir, { recursive: true });

  if (fs.existsSync(iconsDir)) {
    const iconFiles = fs.readdirSync(iconsDir).filter(f => f.endsWith('.png'));
    for (const file of iconFiles) {
      fs.copyFileSync(
        resolve(iconsDir, file),
        resolve(distIconsDir, file)
      );
    }
    console.log(`[Post] Copied ${iconFiles.length} icons.`);
  }

  console.log('\n[SlopGuard] Build complete!');
  console.log('[SlopGuard] Load dist/ folder in chrome://extensions (Developer Mode)');

  // Verify output
  const files = [];
  function listFiles(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        listFiles(resolve(dir, entry.name), prefix + entry.name + '/');
      } else {
        const size = fs.statSync(resolve(dir, entry.name)).size;
        files.push({ name: prefix + entry.name, size });
      }
    }
  }
  listFiles(distDir);

  console.log('\nOutput files:');
  for (const f of files) {
    const sizeKB = (f.size / 1024).toFixed(1);
    console.log(`  ${f.name.padEnd(40)} ${sizeKB} kB`);
  }
}

buildExtension().catch((err) => {
  console.error('[SlopGuard] Build failed:', err);
  process.exit(1);
});
