import assert from 'node:assert/strict';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const budget = 8_388_608;
const delivery = ['src', 'public', 'dist', 'scripts', 'tests', 'licenses', 'artifacts', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.unit.json', 'vite.config.ts', 'README.md', 'DESIGN.md', 'VALIDATION.md'];
const files = [];
async function collect(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    for (const name of await readdir(path)) {
      assert(!['node_modules', '.cache', '.npm'].includes(name), `Generated dependency directory in ${path}`);
      await collect(join(path, name));
    }
  } else {
    assert(!/\.(tgz|zip|tar|gz)$/.test(path), `Unnecessary archive: ${path}`);
    files.push({ path, bytes: info.size });
  }
}
for (const path of delivery) await collect(path);
const total = files.reduce((sum, file) => sum + file.bytes, 0);
assert(total < budget, `Delivery exceeds ${budget} bytes`);
const html = await readFile('dist/index.html', 'utf8');
assert(html.includes('<title>') && html.includes('name="description"') && html.includes('property="og:title"') && html.includes('property="og:image"'));
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
for (const reference of references) {
  if (reference.startsWith('#')) continue;
  assert(reference.startsWith('./'), `Asset URL must be relative: ${reference}`);
  assert((await stat(resolve('dist', reference))).isFile(), `Missing export asset: ${reference}`);
}
for (const file of files.filter(file => file.path.startsWith('dist/') && file.path.endsWith('.css'))) {
  const css = await readFile(file.path, 'utf8');
  for (const [, raw] of css.matchAll(/url\(([^)]+)\)/g)) {
    const reference = raw.replace(/["']/g, '');
    assert(!reference.startsWith('/') && !reference.startsWith('http'), `Nonlocal font URL: ${reference}`);
    assert((await stat(resolve(dirname(file.path), reference))).isFile());
  }
}
for (const path of ['dist/assets/mouse.svg', 'dist/assets/favicon.svg', 'dist/assets/share.png']) assert((await stat(path)).isFile());
const png = await readFile('dist/assets/share.png');
assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
const distBytes = files.filter(file => file.path.startsWith('dist/')).reduce((sum, file) => sum + file.bytes, 0);
// This report deliberately counts itself as well, for an exact final byte total.
const report = { passed: true, exportBytes: distBytes, deliveryBytes: total, budgetBytes: budget, relativeAssets: true, shareImage: '1200 × 630 PNG' };
const reportPath = 'artifacts/export-results.json';
const prior = files.find(file => file.path === reportPath)?.bytes ?? 0;
let serialized = '';
for (let i = 0; i < 5; i++) {
  serialized = JSON.stringify(report, null, 2) + '\n';
  report.deliveryBytes = total - prior + Buffer.byteLength(serialized);
}
serialized = JSON.stringify(report, null, 2) + '\n';
assert(report.deliveryBytes < budget);
await writeFile(reportPath, serialized);
process.stdout.write(serialized);
