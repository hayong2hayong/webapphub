import test from 'node:test';
import assert from 'node:assert/strict';

let createFirebaseAdapter;
try { ({ createFirebaseAdapter } = await import('../server/firebase-adapter.mjs')); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

function responseRecorder() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = Buffer.from(value ?? ''); }
  };
}

test('Firebase adapter preserves API query, method, status, headers and UTF-8 bytes with a fixed internal origin', async () => {
  assert.equal(typeof createFirebaseAdapter, 'function');
  const calls = [];
  const adapter = createFirebaseAdapter({ readKey: () => 'fixture-secret', handler: async (request, env) => {
    calls.push({ url: request.url, method: request.method, env });
    return new Response('한솔고 급식', { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
  } });
  const res = responseRecorder();
  await adapter({ originalUrl: '/api/school-week?date=2026-11-06&date=2026-11-07', method: 'POST', headers: { host: 'untrusted.example' } }, res);
  assert.deepEqual(calls, [{ url: 'https://school.internal/api/school-week?date=2026-11-06&date=2026-11-07', method: 'POST', env: { NEIS_API_KEY: 'fixture-secret' } }]);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'GET');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
  assert.equal(res.body.toString('utf8'), '한솔고 급식');
});

test('Firebase adapter keeps real validation and missing-secret responses without upstream calls', async () => {
  assert.equal(typeof createFirebaseAdapter, 'function');
  const adapter = createFirebaseAdapter({ readKey: () => '' });
  for (const [originalUrl, method, status, code] of [
    ['/api/school-week', 'GET', 503, 'NOT_CONFIGURED'],
    ['/api/school-week?KEY=client-value', 'GET', 400, 'INVALID_QUERY'],
    ['/api/school-week', 'POST', 405, 'METHOD_NOT_ALLOWED'],
    ['/api/other', 'GET', 404, 'NOT_FOUND']
  ]) {
    const res = responseRecorder();
    await adapter({ originalUrl, method }, res);
    assert.equal(res.statusCode, status);
    assert.equal(JSON.parse(res.body).error.code, code);
    assert.equal(res.headers['cache-control'], 'no-store');
  }
});

test('Firebase adapter reads the secret only at request time and redacts unexpected failures', async () => {
  assert.equal(typeof createFirebaseAdapter, 'function');
  let reads = 0;
  const adapter = createFirebaseAdapter({ readKey() { reads++; throw new Error('fixture-secret must stay private'); } });
  assert.equal(reads, 0);
  const res = responseRecorder();
  await adapter({ originalUrl: '/api/school-week', method: 'GET' }, res);
  assert.equal(reads, 1);
  assert.equal(res.statusCode, 500);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(JSON.parse(res.body).error.code, 'INTERNAL_ERROR');
  assert.ok(!res.body.toString().includes('fixture-secret'));
});
