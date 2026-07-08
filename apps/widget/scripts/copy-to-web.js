// Mirrors the canonical build artifact (dist/widget.js, served via CDN in
// production) into apps/web/public so the local preview page can load it
// from the same Next.js dev server without a separate CDN.
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'dist', 'widget.js');
const destDir = path.join(__dirname, '..', '..', 'web', 'public');
const dest = path.join(destDir, 'widget.js');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`copied ${src} -> ${dest}`);
