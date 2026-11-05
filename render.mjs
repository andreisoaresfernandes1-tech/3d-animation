// Renderiza a animação quadro a quadro em MP4 (Playwright + ffmpeg).
// Uso: node render.mjs [--out video/tunel.mp4] [--fps 30] [--start 0] [--end 90] [--still 45 --png shot.png]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const fps = +arg('fps', 30), out = arg('out', 'video/tunel.mp4');
const still = arg('still', null);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
// usa o three.js local em vez do CDN
await page.route('https://cdn.jsdelivr.net/npm/three@*/**', (route) => {
  const rel = new URL(route.request().url()).pathname.replace(/^\/npm\/three@[^/]+\//, '');
  route.fulfill({ path: path.join(root, 'node_modules/three', rel), contentType: 'text/javascript' });
});
await page.goto(`http://localhost:${port}/index.html?render=1`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const duration = await page.evaluate(() => window.DURATION);

if (still) {
  for (const s of still.split(',')) {
    await page.evaluate((t) => window.renderAt(t), +s);
    const file = arg('png', 'shot') .replace(/\.png$/, '') + `-${s}.png`;
    await page.screenshot({ path: file });
    console.log('saved', file);
  }
} else {
  const start = +arg('start', 0), end = +arg('end', duration);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((end - start) * fps), t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.renderAt(t), start + i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) { const el = (Date.now() - t0) / 1000; console.log(`frame ${i}/${n}  ${el.toFixed(0)}s  eta ${((el / (i + 1)) * (n - i)).toFixed(0)}s`); }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('vídeo salvo em', out);
}
await browser.close();
server.close();
