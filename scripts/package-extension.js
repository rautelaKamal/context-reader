/**
 * Builds the distributable extension from the single source in src/extension.
 *
 * There is deliberately no second copy of the extension checked in: the zip
 * and dist folder are generated, gitignored, and always match the source.
 */

import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src', 'extension');
const dist = join(root, 'dist-extension');
const zipPath = join(root, 'public', 'extension.zip');

/** Point the build at a local server with API_BASE=http://localhost:3000 */
const apiBase = process.env.API_BASE;

/**
 * `--store` produces the build for submission: localhost is stripped from the
 * host permissions, because a published extension has no business asking to
 * reach the developer's machine, and reviewers flag permissions a listing
 * cannot justify.
 */
const forStore = process.argv.includes('--store');

async function build() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await mkdir(join(root, 'public'), { recursive: true });

  await cp(source, dist, { recursive: true });

  if (apiBase) {
    const file = join(dist, 'background.js');
    const original = await readFile(file, 'utf8');
    const patched = original.replace(
      /const DEFAULT_API = '[^']*';/,
      `const DEFAULT_API = '${apiBase}';`,
    );
    if (patched === original) {
      throw new Error('Could not rewrite DEFAULT_API in background.js');
    }
    await writeFile(file, patched);
    console.log(`API base set to ${apiBase}`);
  }

  const manifestPath = join(dist, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (forStore) {
    if (apiBase) throw new Error('A store build cannot point at API_BASE - it must use the default.');
    const before = manifest.host_permissions.length;
    manifest.host_permissions = manifest.host_permissions.filter((h) => !h.includes('localhost'));
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Store build: dropped ${before - manifest.host_permissions.length} localhost permission`);
  }

  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(dist, false);
    archive.finalize();
  });

  console.log(`Packaged ${manifest.name} v${manifest.version}${forStore ? ' (for the Chrome Web Store)' : ''}`);
  console.log(`  unpacked: dist-extension/`);
  console.log(`  zip:      public/extension.zip`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
