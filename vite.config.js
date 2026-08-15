import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Vite config untuk Chrome Extension (Manifest V3).
 * 
 * ES module format, tapi SEMUA shared code di-inline ke setiap entry point
 * (no code splitting/chunks) agar content script dan service worker self-contained.
 */
export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development' ? 'inline' : false,
    minify: mode !== 'development',
    target: 'esnext',
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'content': resolve(__dirname, 'src/content/content.js'),
        'popup': resolve(__dirname, 'src/popup/popup.html'),
        'options': resolve(__dirname, 'src/options/options.html'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return '[name].[ext]';
          }
          return 'assets/[name].[ext]';
        },
        // Force inline ALL shared modules — no chunks directory
        manualChunks: () => undefined,
      },
      // Treeshake aggressively
      treeshake: {
        moduleSideEffects: true,
      },
    },
  },
  plugins: [
    {
      name: 'slopguard-post-build',
      async closeBundle() {
        const distDir = resolve(__dirname, 'dist');

        // 1. Read and adjust manifest.json
        const manifest = JSON.parse(fs.readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));

        // Fix HTML paths — Vite preserves input directory structure for HTML
        const popupPath = 'src/popup/popup.html';
        const optionsPath = 'src/options/options.html';
        
        if (fs.existsSync(resolve(distDir, popupPath))) {
          manifest.action.default_popup = popupPath;
        }
        if (fs.existsSync(resolve(distDir, optionsPath))) {
          manifest.options_page = optionsPath;
        }

        fs.writeFileSync(
          resolve(distDir, 'manifest.json'),
          JSON.stringify(manifest, null, 2)
        );

        // 2. Copy icons
        const iconsDir = resolve(__dirname, 'src/assets/icons');
        const distIconsDir = resolve(distDir, 'icons');
        if (!fs.existsSync(distIconsDir)) {
          fs.mkdirSync(distIconsDir, { recursive: true });
        }

        if (fs.existsSync(iconsDir)) {
          const iconFiles = fs.readdirSync(iconsDir).filter(f => f.endsWith('.png'));
          for (const file of iconFiles) {
            fs.copyFileSync(
              resolve(iconsDir, file),
              resolve(distIconsDir, file)
            );
          }
        }

        // 3. Post-process: inline chunks into entry points if any were created
        // This handles the case where Rollup still creates shared chunks
        await inlineChunks(distDir);

        console.log('\n[SlopGuard] Build complete!');
        console.log('[SlopGuard] Load dist/ folder in chrome://extensions (Developer Mode)\n');
      },
    },
  ],
}));

/**
 * Post-process: jika Rollup masih membuat chunks, inline mereka ke entry points.
 * Lalu hapus direktori chunks.
 */
async function inlineChunks(distDir) {
  const chunksDir = resolve(distDir, 'chunks');
  if (!fs.existsSync(chunksDir)) return;

  const chunkFiles = fs.readdirSync(chunksDir).filter(f => f.endsWith('.js'));
  if (chunkFiles.length === 0) return;

  // Read all chunks
  const chunks = {};
  for (const file of chunkFiles) {
    chunks[`./chunks/${file}`] = fs.readFileSync(resolve(chunksDir, file), 'utf-8');
  }

  // Process each JS entry file in dist root
  const entryFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));

  for (const entryFile of entryFiles) {
    const entryPath = resolve(distDir, entryFile);
    let content = fs.readFileSync(entryPath, 'utf-8');

    // Find all chunk imports and inline them
    let hasChunkImports = false;
    for (const [chunkPath, chunkContent] of Object.entries(chunks)) {
      // Match: import{...}from"./chunks/name.js";
      const importRegex = new RegExp(
        `import\\s*\\{([^}]+)\\}\\s*from\\s*["']${chunkPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'];?`,
        'g'
      );

      if (importRegex.test(content)) {
        hasChunkImports = true;

        // Extract exports from chunk
        // Prepend chunk content (without its own imports) at top
        // Then replace import statement with nothing (exports are now in scope)
        
        // Simple approach: convert chunk exports to const declarations
        // and prepend, then remove the import line
        content = content.replace(importRegex, '');
      }
    }

    if (hasChunkImports) {
      // Prepend all chunk contents
      let preamble = '';
      for (const [, chunkContent] of Object.entries(chunks)) {
        // Remove export statements from chunk, convert to regular declarations
        let inlined = chunkContent
          .replace(/export\s*\{[^}]*\};\s*/g, '') // Remove export { } statements
          .trim();
        preamble += inlined + '\n';
      }
      content = preamble + content;
      fs.writeFileSync(entryPath, content);
    }
  }

  // Also process HTML files that may reference chunks
  const htmlDirs = ['src/popup', 'src/options'];
  for (const dir of htmlDirs) {
    const htmlDir = resolve(distDir, dir);
    if (!fs.existsSync(htmlDir)) continue;

    const htmlFiles = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));
    for (const htmlFile of htmlFiles) {
      const htmlPath = resolve(htmlDir, htmlFile);
      let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      
      // Remove modulepreload links to chunks
      htmlContent = htmlContent.replace(
        /<link\s+rel="modulepreload"[^>]*href="[^"]*chunks[^"]*"[^>]*>/g,
        ''
      );
      
      fs.writeFileSync(htmlPath, htmlContent);
    }
  }

  // Clean up chunks directory
  fs.rmSync(chunksDir, { recursive: true, force: true });
  console.log(`[SlopGuard] Inlined ${chunkFiles.length} chunk(s) into entry points.`);
}
