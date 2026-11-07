import { readdir, readFile, writeFile, mkdir, rm, lstat } from 'node:fs/promises';
import { resolve, join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_EXTENSIONS = new Set(['.html', '.css', '.mjs', '.js', '.svg', '.json', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico', '.woff', '.woff2']);

export async function buildFirebase(projectRoot) {
  const root = resolve(projectRoot);
  const source = join(root, 'dist');
  const output = join(root, 'firebase-public');
  const assets = [];
  async function collect(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || (!prefix && entry.name.toLowerCase() === 'server') || entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await collect(path, name);
      else if (entry.isFile() && PUBLIC_EXTENSIONS.has(extname(entry.name).toLowerCase())) assets.push([name, await readFile(path)]);
    }
  }
  await collect(source);
  if (!assets.some(([name]) => name === 'index.html')) throw new Error('dist/index.html is required');
  // Only this generated directory inside the selected project may be replaced.
  if (relative(root, output) !== 'firebase-public') throw new Error('Unsafe build output');
  try {
    if ((await lstat(output)).isSymbolicLink()) throw new Error('Build output must not be a symlink');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const [name, bytes] of assets) {
    const target = join(output, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  return { assetCount: assets.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log(JSON.stringify(await buildFirebase(process.cwd())));
}
