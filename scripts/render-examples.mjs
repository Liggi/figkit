// Renders every example into out/ and exits non-zero if any reports a problem.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const files = [...fs.readdirSync(path.join(root, 'examples')).filter((f) => f.endsWith('.html')).map((f) => `examples/${f}`),
  ...fs.readdirSync(path.join(root, 'examples/charts')).filter((f) => f.endsWith('.json')).map((f) => `examples/charts/${f}`)];
let bad = 0;
for (const f of files) {
  const out = path.join(root, 'out', path.basename(f).replace(/\.\w+$/, '.png'));
  const text = execFileSync(process.execPath, [path.join(root, 'bin/fig.mjs'), path.join(root, f), '--out', out], { encoding: 'utf8' });
  const ok = text.includes('No problems found by the checks.');
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f}${ok ? '' : '\n' + text}`);
}
process.exit(bad ? 1 : 0);
