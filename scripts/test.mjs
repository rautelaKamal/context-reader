/**
 * Compiles the pure library modules to CommonJS in a scratch directory, then
 * runs the test suite against them. Doing it this way keeps the repo free of
 * a test-framework dependency while still letting the tests import real code
 * rather than a copy of it.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.test-build');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

execFileSync(
  'npx',
  [
    'tsc',
    'src/lib/modes.ts', 'src/lib/prompts.ts', 'src/lib/context.ts', 'src/lib/ratelimit.ts',
    '--outDir', out,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--skipLibCheck',
  ],
  { cwd: root, stdio: 'inherit' },
);

// The repo is type: module, so mark the compiled output as CommonJS.
writeFileSync(join(out, 'package.json'), JSON.stringify({ type: 'commonjs' }));

execFileSync('node', ['--test', 'tests/'], { cwd: root, stdio: 'inherit' });
