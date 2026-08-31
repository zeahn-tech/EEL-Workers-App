import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve('.');
const distDir = path.join(projectRoot, 'dist');

console.log('🔧 Running post-build steps...');

// Create .nojekyll and a 404->index fallback inside dist/ so client-side routing
// and GitHub Pages both behave, if you ever deploy the dist/ folder directly
// (e.g. via `npx gh-pages -d dist`, Netlify, or Vercel).
//
// NOTE: if you're using the included .github/workflows/deploy.yml (recommended),
// GitHub Actions builds and publishes dist/ automatically on every push — this
// script and a manually-committed dist/ folder are no longer part of that path
// at all, so there's nothing here that can go stale.
fs.writeFileSync(path.join(distDir, '.nojekyll'), '# Disable Jekyll\n');

const distIndex = path.join(distDir, 'index.html');
const dist404 = path.join(distDir, '404.html');
if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, dist404);
  console.log('✅ Created dist/.nojekyll and dist/404.html');
}

console.log('🎉 Post-build complete.');
