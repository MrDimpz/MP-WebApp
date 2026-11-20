import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

const ROOT_DIR = import.meta.dirname || process.cwd();
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const PUBLIC_ZIP_PATH = path.resolve(ROOT_DIR, 'public/the-missing-piece-hostinger.zip');

function generateHostingerZipFromDist(): void {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    return;
  }

  // Create deterministic index-latest.js and index-latest.css copies so .htaccess can redirect any cached hash
  const assetsDir = path.join(DIST_DIR, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    const mainJs = assetFiles.find(
      (f) => f.startsWith('index-') && f.endsWith('.js') && f !== 'index-latest.js'
    );
    if (mainJs) {
      fs.copyFileSync(path.join(assetsDir, mainJs), path.join(assetsDir, 'index-latest.js'));
    }
    const mainCss = assetFiles.find(
      (f) => f.startsWith('index-') && f.endsWith('.css') && f !== 'index-latest.css'
    );
    if (mainCss) {
      fs.copyFileSync(path.join(assetsDir, mainCss), path.join(assetsDir, 'index-latest.css'));
    }
  }

  // Remove any recursive copy of the zip inside dist/ before packaging
  const distZip = path.join(DIST_DIR, 'the-missing-piece-hostinger.zip');
  if (fs.existsSync(distZip)) {
    try {
      fs.unlinkSync(distZip);
    } catch {}
  }

  const publicDir = path.resolve(ROOT_DIR, 'public');

  const pyScript = `
import os, shutil, zipfile

dist_dir = ${JSON.stringify(DIST_DIR)}
public_dir = ${JSON.stringify(publicDir)}
zip_path = ${JSON.stringify(PUBLIC_ZIP_PATH)}
dist_zip_path = ${JSON.stringify(distZip)}
tmp_zip_path = zip_path + ".tmp"

store_exts = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.woff', '.woff2'}
added_names = set()

with zipfile.ZipFile(tmp_zip_path, 'w') as zf:
    for root, dirs, files in os.walk(dist_dir):
        for file in sorted(files):
            if file.endswith('.zip') or file.endswith('.tmp'):
                continue
            full_path = os.path.join(root, file)
            arcname = os.path.relpath(full_path, dist_dir).replace('\\\\', '/')
            # Skip unused chat attachment screenshots while keeping 3d_logo_944e5372.png
            if arcname.startswith('assets/aistudio/') and arcname != 'assets/aistudio/3d_logo_944e5372.png':
                continue
            if arcname == '3d_logo_944e5372.png':
                continue
            ext = os.path.splitext(file)[1].lower()
            compress_type = zipfile.ZIP_STORED if ext in store_exts else zipfile.ZIP_DEFLATED
            zf.write(full_path, arcname, compress_type=compress_type)
            added_names.add(arcname)

    # Ensure PHP/Apache fallback files are included in the static ZIP even if stripped from Node dist/
    for extra_rel in ('.htaccess', 'api/relay.php'):
        if extra_rel not in added_names:
            src_extra = os.path.join(public_dir, extra_rel)
            if os.path.isfile(src_extra):
                zf.write(src_extra, extra_rel, compress_type=zipfile.ZIP_DEFLATED)

os.replace(tmp_zip_path, zip_path)
shutil.copyfile(zip_path, dist_zip_path)
`;

  execFileSync('python3', ['-c', pyScript], { stdio: 'ignore' });
}

function stripApacheRewriteFilesFromDist(): void {
  const distHtaccess = path.join(DIST_DIR, '.htaccess');
  if (fs.existsSync(distHtaccess)) {
    try {
      fs.unlinkSync(distHtaccess);
    } catch {}
  }
  const distRelayPhp = path.join(DIST_DIR, 'api', 'relay.php');
  if (fs.existsSync(distRelayPhp)) {
    try {
      fs.unlinkSync(distRelayPhp);
      const apiDir = path.join(DIST_DIR, 'api');
      if (fs.existsSync(apiDir) && fs.readdirSync(apiDir).length === 0) {
        fs.rmdirSync(apiDir);
      }
    } catch {}
  }
}

function hostingerZipPlugin(): Plugin {
  return {
    name: 'hostinger-zip-plugin',
    closeBundle() {
      if (process.env.SKIP_HOSTINGER_ZIP !== 'true') {
        try {
          generateHostingerZipFromDist();
        } catch (err) {
          console.warn('Failed to generate Hostinger zip in closeBundle:', err);
        }
      }
      // Keep Node.js dist/ clean of Apache .htaccess/relay.php rewrite rules
      stripApacheRewriteFilesFromDist();
    },
    configureServer(server) {
      const handleZipDownload = (req: any, res: any, next: any) => {
        const urlPath = (req.url || '').split('?')[0];
        if (
          urlPath !== '/the-missing-piece-hostinger.zip' &&
          urlPath !== '/api/download-hostinger-zip'
        ) {
          return next();
        }

        try {
          // Ensure dist exists and is packaged into a fresh zip
          if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
            execFileSync('npx', ['vite', 'build'], {
              cwd: ROOT_DIR,
              env: {
                ...process.env,
                SKIP_HOSTINGER_ZIP: 'true',
                VITE_HIDE_HOSTINGER_DOWNLOAD: 'true',
              },
              stdio: 'ignore',
            });
          }
          generateHostingerZipFromDist();

          if (!fs.existsSync(PUBLIC_ZIP_PATH)) {
            res.statusCode = 404;
            res.end('Hostinger zip archive not found');
            return;
          }

          const stat = fs.statSync(PUBLIC_ZIP_PATH);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Length', String(stat.size));
          res.setHeader(
            'Content-Disposition',
            'attachment; filename="the-missing-piece-hostinger.zip"'
          );
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

          const stream = fs.createReadStream(PUBLIC_ZIP_PATH);
          stream.pipe(res);
        } catch (err) {
          console.error('Error serving Hostinger zip:', err);
          next(err);
        }
      };

      server.middlewares.use(handleZipDownload);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), hostingerZipPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(ROOT_DIR, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio.
      hmr: false as const,
      ws: false as const,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
