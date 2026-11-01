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

  // Only a default build gets zipped. The zip is what gets uploaded to the
  // store, so it must not be able to hold a build pointing at a laptop.
  // Making that structural beats a flag someone has to remember to pass.
  if (apiBase) {
    console.log(`Packaged ${manifest.name} v${manifest.version} for local use`);
    console.log('  unpacked: dist-extension/');
    console.log('  no zip, because API_BASE is set');
    return;
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

  console.log(`Packaged ${manifest.name} v${manifest.version}`);
  console.log(`  unpacked: dist-extension/`);
  console.log(`  zip:      public/extension.zip`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
