import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';

let buildFirebase;
try { ({ buildFirebase } = await import('../scripts/build-firebase.mjs')); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

test('Firebase build publishes only browser assets, excludes server/hidden files and removes stale output', async () => {
  assert.equal(typeof buildFirebase, 'function');
  const root = await mkdtemp(join(tmpdir(), 'firebase-build-'));
  try {
    for (const dir of ['dist/lib', 'dist/server', 'dist/.openai', 'firebase-public']) await mkdir(join(root, dir), { recursive: true });
    for (const [path, body] of Object.entries({
      'dist/index.html': '<h1>교실 도구함</h1>', 'dist/lib/client.mjs': 'export const publicValue = true;',
      'dist/server/index.js': 'private backend bundle', 'dist/.openai/hosting.json': '{"project_id":"private-metadata"}',
      'dist/.env.local': 'NEIS_API_KEY=fixture-secret', 'dist/notes.txt': 'private notes', 'firebase-public/stale.js': 'old output'
    })) await writeFile(join(root, path), body);
    const result = await buildFirebase(root);
    assert.equal(result.assetCount, 2);
    assert.equal(await readFile(join(root, 'firebase-public/index.html'), 'utf8'), '<h1>교실 도구함</h1>');
    assert.deepEqual((await readdir(join(root, 'firebase-public'))).sort(), ['index.html', 'lib']);
    await assert.rejects(access(join(root, 'firebase-public/server/index.js')));
    await assert.rejects(access(join(root, 'firebase-public/.openai/hosting.json')));
    await assert.rejects(access(join(root, 'firebase-public/.env.local')));
    await assert.rejects(access(join(root, 'firebase-public/stale.js')));
    await assert.rejects(access(join(root, 'firebase-public/notes.txt')));
  } finally {
    assert.ok(relative(resolve(tmpdir()), resolve(root)).startsWith('firebase-build-'));
    await rm(root, { recursive: true, force: true });
  }
});
