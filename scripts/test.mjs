/**
 * Compiles the pure library modules to CommonJS in a scratch directory, then
 * runs the test suite against them. Doing it this way keeps the repo free of
 * a test-framework dependency while still letting the tests import real code
 * rather than a copy of it.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
    'src/lib/modes.ts', 'src/lib/prompts.ts', 'src/lib/context.ts',
    'src/lib/cors.ts', 'src/lib/quota.ts', 'src/lib/stream.ts', 'src/lib/provider.ts',
    '--outDir', out,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--skipLibCheck',
  ],
  { cwd: root, stdio: 'inherit' },
);

// The repo is type: module, so mark the compiled output as CommonJS.
writeFileSync(join(out, 'package.json'), JSON.stringify({ type: 'commonjs' }));

// Pass the files explicitly. Node 20 reads a bare `tests/` as a directory to
// search but cannot expand globs; Node 22 matches arguments as globs, so the
// same bare `tests/` resolves to a filename that does not exist and nothing
// runs. Listing the files ourselves means neither version has to guess.
const testFiles = readdirSync(join(root, 'tests'))
  .filter((name) => name.endsWith('.test.cjs'))
  .sort()
  .map((name) => join('tests', name));

// A runner that finds nothing still exits 0, which is indistinguishable from
// everything passing. Treat it as the failure it is.
if (testFiles.length === 0) throw new Error('No test files matched tests/*.test.cjs');

execFileSync('node', ['--test', ...testFiles], { cwd: root, stdio: 'inherit' });
