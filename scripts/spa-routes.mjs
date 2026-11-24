// GitHub Pages serves /foo from foo.html with HTTP 200; without it, deep links
// only work through 404.html and return status 404.
import { copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const index = resolve(dist, 'index.html');
const app = readFileSync(resolve(root, 'src/App.jsx'), 'utf8');

const routes = [...app.matchAll(/<Route\s+path="\/([^"]+)"/g)]
  .map((match) => match[1])
  .filter((path) => !path.includes(':') && !path.includes('*') && !path.includes('/'));

if (routes.length === 0) {
  throw new Error('Nessuna route trovata in src/App.jsx');
}

copyFileSync(index, resolve(dist, '404.html'));
for (const route of routes) {
  copyFileSync(index, resolve(dist, `${route}.html`));
}

console.log(`404.html + ${routes.length} route statiche: ${routes.join(', ')}`);
