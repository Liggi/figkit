/* Bundles viz/ into dist/viz.iife.js (window.figkitViz), which figure pages load to draw split bars, bars and chart specs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['viz/draw.js', 'package.json'].map((f) => path.join(HOME, f));
const OUT = path.join(HOME, 'dist/viz.iife.js');

const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);

/**
 * Builds dist/ when a source is newer than it, so `fig` never runs a stale bundle. An installed package ships dist/
 * without esbuild, and npm gives every file the same date, so there the shipped bundle is used as it is.
 */
export async function ensureBuilt({ force = false } = {}) {
  const newest = Math.max(...SOURCES.map(mtime));
  if (!force && mtime(OUT) >= newest) return;
  const esbuild = await import('esbuild').catch(() => null);
  if (!esbuild) {
    if (fs.existsSync(OUT)) return;
    throw new Error('dist/viz.iife.js is missing and esbuild is not installed: run npm install in the figkit folder.');
  }
  await esbuild.build({ entryPoints: [path.join(HOME, 'viz/draw.js')], bundle: true, minify: true, format: 'iife', globalName: 'figkitViz', outfile: OUT, logLevel: 'warning' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await ensureBuilt({ force: true });
