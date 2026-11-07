import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchoolHandler } from '../server/school-api.mjs';

const ENV = { NEIS_API_KEY: 'fixture-only-credential' };
const NOW = () => new Date('2026-11-07T09:00:00.000Z');
const SCHOOL = { ATPT_OFCDC_SC_CODE: 'I10', SD_SCHUL_CODE: '9300058', SCHUL_NM: '한솔고등학교' };
const EMPTY = { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };
const request = (query = '?date=2026-11-07', method = 'GET') => new Request(`https://classroom.example/api/school-week${query}`, { method });
const meal = (overrides = {}) => ({ ...SCHOOL, MLSV_YMD: '20261102', MMEAL_SC_CODE: '2', MMEAL_SC_NM: '중식', DDISH_NM: '현미밥<br/>두부국 (5.6)<BR >배추김치 (9)', CAL_INFO: '723.5 Kcal', ORPLC_INFO: 'not-public', ...overrides });
const lesson = (overrides = {}) => ({ ...SCHOOL, AY: '2026', SEM: '2', ALL_TI_YMD: '20261102', GRADE: '2', CLASS_NM: '8', PERIO: '1', ITRT_CNTNT: '문학', CLRM_NM: '2-8', DGHT_CRSE_SC_NM: '주간', ORD_SC_NM: '일반계', DDDEP_NM: '일반과', LOAD_DTM: 'not-public', ...overrides });
const envelope = (service, rows, total = rows.length) => ({ [service]: [{ head: [{ list_total_count: total }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' } }] }, { row: rows }] });
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

test('retrieves Type=json data when NEIS rejects an application/json Accept header', async () => {
  const fixture = fixtureFetcher();
  const fetcher = (input, options) => new Headers(options.headers).get('Accept') === 'application/json'
    ? new Response('Not acceptable by upstream', { status: 500 }) : fixture(input, options);
  const { data } = await read(createSchoolHandler({ now: NOW, fetcher }));
  assert.equal(data.meals.status, 'ok');
  assert.equal(data.timetable.status, 'ok');
});

test('uses Worker-supported manual redirects and rejects upstream redirects without following them', async () => {
  const fixture = fixtureFetcher();
  const fetcher = (input, options) => {
    if (options.redirect === 'error') throw new TypeError('Invalid redirect value: Workers support follow or manual');
    assert.equal(options.redirect, 'manual');
    return fixture(input, options);
  };
  const { data } = await read(createSchoolHandler({ now: NOW, fetcher }));
  assert.equal(data.meals.status, 'ok');
  assert.equal(data.timetable.status, 'ok');
  const redirected = await read(createSchoolHandler({ now: NOW, fetcher: async (_input, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example/' } });
  } }));
  assert.equal(redirected.data.meals.status, 'error');
  assert.equal(redirected.data.timetable.status, 'error');
});
function fixtureFetcher(meals = [meal()], timetable = [lesson()], calls = []) {
  return async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    const service = url.pathname.split('/').at(-1);
    return json(envelope(service, service === 'mealServiceDietInfo' ? meals : timetable));
  };
}
async function read(handler, req = request(), env = ENV) {
  const response = await handler(req, env, {});
  return { response, data: await response.json() };
}

test('normalizes a Saturday to the complete Monday–Sunday contract and preserves parallel lessons', async () => {
  const handler = createSchoolHandler({ now: NOW, fetcher: fixtureFetcher([meal()], [lesson(), lesson({ ITRT_CNTNT: '생명과학', CLRM_NM: '과학실' })]) });
  const { response, data } = await read(handler);
  assert.equal(response.status, 200);
  assert.deepEqual(data.school, { name: '한솔고등학교', educationCode: 'I10', schoolCode: '9300058' });
  assert.equal(data.grade, 2);
  assert.equal(data.className, '8');
  assert.deepEqual(data.week, { start: '2026-11-02', end: '2026-11-08', dates: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'] });
  assert.equal(data.updatedAt, '2026-11-07T09:00:00.000Z');
  assert.deepEqual(data.meals, { status: 'ok', rows: [{ date: '2026-11-02', typeCode: '2', typeName: '중식', dishes: ['현미밥', '두부국 (5.6)', '배추김치 (9)'], calories: '723.5 Kcal' }] });
  assert.deepEqual(data.timetable.rows, [
    { date: '2026-11-02', period: 1, subject: '문학', classroom: '2-8', course: '일반계', department: '일반과' },
    { date: '2026-11-02', period: 1, subject: '생명과학', classroom: '과학실', course: '일반계', department: '일반과' }
  ]);
  assert.deepEqual(Object.keys(data).sort(), ['school', 'grade', 'className', 'week', 'updatedAt', 'meals', 'timetable'].sort());
});

test('defaults to today in KST across UTC midnight and a year boundary', async () => {
  const handler = createSchoolHandler({ now: () => new Date('2026-12-31T15:01:00.000Z'), fetcher: fixtureFetcher([], []) });
  const { data } = await read(handler, request(''));
  assert.equal(data.week.start, '2026-12-28');
  assert.equal(data.week.end, '2027-01-03');
});

test('accepts a real leap day within the current KST year ±1', async () => {
  const handler = createSchoolHandler({ now: () => new Date('2027-12-31T15:00:00.000Z'), fetcher: fixtureFetcher([], []) });
  assert.equal((await read(handler, request('?date=2028-02-29'))).response.status, 200);
  assert.equal((await read(handler, request('?date=2029-01-01'))).response.status, 200);
  assert.equal((await read(handler, request('?date=2030-01-01'))).response.status, 400);
});

test('rejects impossible, ambiguous, empty and out-of-range dates before fetching', async () => {
  let calls = 0;
  const handler = createSchoolHandler({ now: NOW, fetcher: async () => { calls++; throw new Error('must not fetch'); } });
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01', '2026-11-07T00:00:00Z', '', '2024-12-31', '2028-01-01']) {
    const { response, data } = await read(handler, request(`?date=${encodeURIComponent(date)}`));
    assert.equal(response.status, 400, date);
    assert.equal(typeof data.error.code, 'string');
  }
  assert.equal(calls, 0);
});

test('rejects methods, wrong paths, duplicate dates and every unsupported query', async () => {
  let calls = 0;
  const handler = createSchoolHandler({ now: NOW, fetcher: async () => { calls++; throw new Error('must not fetch'); } });
  const post = await read(handler, request('?date=2026-11-07', 'POST'));
  assert.equal(post.response.status, 405);
  assert.equal(post.response.headers.get('Allow'), 'GET');
  for (const query of ['?date=2026-11-07&date=2026-11-08', '?school=elsewhere', '?url=https%3A%2F%2Fevil.example', '?KEY=client-key', '?date=2026-11-07&grade=1']) {
    assert.equal((await read(handler, request(query))).response.status, 400, query);
  }
  assert.equal((await read(handler, new Request('https://classroom.example/api/other'))).response.status, 404);
  assert.equal(calls, 0);
});

test('requires the server environment credential and never falls back to sample data', async () => {
  let calls = 0;
  const handler = createSchoolHandler({ now: NOW, fetcher: async () => { calls++; throw new Error('must not fetch'); } });
  for (const env of [undefined, {}, { NEIS_API_KEY: '' }, { NEIS_API_KEY: '   ' }]) {
    const response = await handler(request(), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'NOT_CONFIGURED');
    assert.match(response.headers.get('Cache-Control'), /no-store/);
  }
  assert.equal(calls, 0);
});

test('builds only official HTTPS requests with fixed school, class, complete ranges and server auth', async () => {
  const calls = [];
  const handler = createSchoolHandler({ now: NOW, fetcher: fixtureFetcher([meal()], [lesson()], calls) });
  const { response, data } = await read(handler);
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.equal(url.origin, 'https://open.neis.go.kr');
    assert.equal(url.searchParams.get('KEY'), ENV.NEIS_API_KEY);
    assert.equal(url.searchParams.get('Type'), 'json');
    assert.equal(url.searchParams.get('pIndex'), '1');
    assert.equal(url.searchParams.get('pSize'), '1000');
    assert.equal(url.searchParams.get('ATPT_OFCDC_SC_CODE'), 'I10');
    assert.equal(url.searchParams.get('SD_SCHUL_CODE'), '9300058');
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    if (url.pathname.endsWith('hisTimetable')) {
      assert.equal(url.searchParams.get('GRADE'), '2');
      assert.equal(url.searchParams.get('CLASS_NM'), '8');
      assert.equal(url.searchParams.get('TI_FROM_YMD'), '20261102');
      assert.equal(url.searchParams.get('TI_TO_YMD'), '20261108');
    } else {
      assert.equal(url.pathname, '/hub/mealServiceDietInfo');
      assert.equal(url.searchParams.get('MLSV_FROM_YMD'), '20261102');
      assert.equal(url.searchParams.get('MLSV_TO_YMD'), '20261108');
    }
  }
  assert.ok(!JSON.stringify(data).includes(ENV.NEIS_API_KEY));
  assert.ok(!JSON.stringify([...response.headers]).includes(ENV.NEIS_API_KEY));
});

test('filters mismatched school, class, grade, date and malformed rows', async () => {
  const meals = [meal(), meal({ SD_SCHUL_CODE: '9999999' }), meal({ ATPT_OFCDC_SC_CODE: 'B10' }), meal({ MLSV_YMD: '20261109' }), meal({ MLSV_YMD: '20260230' }), null];
  const timetable = [lesson(), lesson({ GRADE: '1' }), lesson({ CLASS_NM: '7' }), lesson({ SD_SCHUL_CODE: '9999999' }), lesson({ ALL_TI_YMD: '20261101' }), lesson({ PERIO: 'bad' }), null];
  const { data } = await read(createSchoolHandler({ now: NOW, fetcher: fixtureFetcher(meals, timetable) }));
  assert.equal(data.meals.rows.length, 1);
  assert.equal(data.timetable.rows.length, 1);
  assert.ok(!JSON.stringify(data).includes('not-public'));
});

test('removes meal markup while keeping every allergy number and strips credential echoes', async () => {
  const { data } = await read(createSchoolHandler({ now: NOW, fetcher: fixtureFetcher([meal({ DDISH_NM: '<b>우유 (2)</b><br />국 (1.5.6.13.18)<BR/>사과', CAL_INFO: ENV.NEIS_API_KEY })], [lesson({ ITRT_CNTNT: `<b>과학</b> ${ENV.NEIS_API_KEY}` })]) }));
  assert.deepEqual(data.meals.rows[0].dishes, ['우유 (2)', '국 (1.5.6.13.18)', '사과']);
  assert.ok(!JSON.stringify(data).includes(ENV.NEIS_API_KEY));
  assert.ok(!JSON.stringify(data).includes('<b>'));
});

test('recognizes INFO-200 as empty independently for both panels', async () => {
  const handler = createSchoolHandler({ now: NOW, fetcher: async () => json(EMPTY) });
  const { response, data } = await read(handler);
  assert.equal(response.status, 200);
  assert.deepEqual(data.meals, { status: 'empty', rows: [] });
  assert.deepEqual(data.timetable, { status: 'empty', rows: [] });
});

test('isolates auth failures from successful timetable rows and hides upstream messages', async () => {
  const handler = createSchoolHandler({ now: NOW, fetcher: async input => {
    const service = new URL(input).pathname.split('/').at(-1);
    return json(service === 'mealServiceDietInfo' ? { RESULT: { CODE: 'ERROR-300', MESSAGE: `invalid ${ENV.NEIS_API_KEY} internal.example` } } : envelope(service, [lesson()]));
  } });
  const { response, data } = await read(handler);
  assert.equal(response.status, 200);
  assert.equal(data.meals.status, 'error');
  assert.deepEqual(data.meals.rows, []);
  assert.equal(data.timetable.status, 'ok');
  assert.ok(!JSON.stringify(data).includes('internal.example'));
  assert.ok(!JSON.stringify(data).includes(ENV.NEIS_API_KEY));
  assert.match(response.headers.get('Cache-Control'), /no-store/);
});

test('network, HTTP, malformed JSON and bad result structures produce safe errors', async () => {
  const failures = [
    async () => { throw new Error(`request ${ENV.NEIS_API_KEY} failed`); },
    async () => new Response(`upstream ${ENV.NEIS_API_KEY}`, { status: 502 }),
    async () => new Response('<html>not JSON</html>'),
    async () => json({ unexpected: ENV.NEIS_API_KEY }),
    async () => json({ mealServiceDietInfo: [{ head: [{ list_total_count: 'broken' }] }, { row: [] }] })
  ];
  for (const fetcher of failures) {
    const { response, data } = await read(createSchoolHandler({ now: NOW, fetcher }));
    assert.equal(response.status, 200);
    assert.equal(data.meals.status, 'error');
    assert.equal(data.timetable.status, 'error');
    assert.ok(!JSON.stringify(data).includes(ENV.NEIS_API_KEY));
    assert.ok(!JSON.stringify(data).includes('<html>'));
  }
});

test('fetches a second page until all 1001 timetable rows are collected', async () => {
  const pages = [];
  const fetcher = async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('mealServiceDietInfo')) return json(EMPTY);
    const page = Number(url.searchParams.get('pIndex'));
    pages.push(page);
    return json(envelope('hisTimetable', Array.from({ length: page === 1 ? 1000 : 1 }, (_, index) => lesson({ ITRT_CNTNT: `과목${page}-${index}` })), 1001));
  };
  const { data } = await read(createSchoolHandler({ now: NOW, fetcher }));
  assert.equal(data.timetable.status, 'ok');
  assert.equal(data.timetable.rows.length, 1001);
  assert.deepEqual(pages, [1, 2]);
});

test('rejects totals above 2000 rather than presenting truncated lessons', async () => {
  let calls = 0;
  const { data } = await read(createSchoolHandler({ now: NOW, fetcher: async input => {
    calls++;
    const service = new URL(input).pathname.split('/').at(-1);
    return json(envelope(service, service === 'hisTimetable' ? [lesson()] : [meal()], 2001));
  } }));
  assert.equal(data.timetable.status, 'error');
  assert.equal(data.meals.status, 'error');
  assert.deepEqual(data.timetable.rows, []);
  assert.equal(calls, 2);
});

test('rejects incomplete, unexpectedly short and inconsistent pagination without partial rows', async () => {
  for (const secondPage of [EMPTY, envelope('hisTimetable', [], 1001), envelope('hisTimetable', [lesson()], 1002)]) {
    const { data } = await read(createSchoolHandler({ now: NOW, fetcher: async input => {
      const url = new URL(input);
      if (url.pathname.endsWith('mealServiceDietInfo')) return json(EMPTY);
      return json(url.searchParams.get('pIndex') === '1' ? envelope('hisTimetable', Array.from({ length: 1000 }, () => lesson()), 1001) : secondPage);
    } }));
    assert.equal(data.timetable.status, 'error');
    assert.deepEqual(data.timetable.rows, []);
  }
  const { data } = await read(createSchoolHandler({ now: NOW, fetcher: async input => {
    const service = new URL(input).pathname.split('/').at(-1);
    return json(envelope(service, service === 'hisTimetable' ? [lesson()] : [meal()], 5));
  } }));
  assert.equal(data.timetable.status, 'error');
});

test('caches canonical weeks for five minutes and returns fresh consumable responses', async () => {
  let current = new Date('2026-11-07T09:00:00Z');
  const calls = [];
  const handler = createSchoolHandler({ now: () => current, fetcher: fixtureFetcher([meal()], [lesson()], calls) });
  const first = await read(handler);
  const sameWeek = await read(handler, request('?date=2026-11-02'));
  assert.equal(calls.length, 2);
  assert.deepEqual(sameWeek.data, first.data);
  assert.match(first.response.headers.get('Cache-Control'), /max-age=300/);
  current = new Date('2026-11-07T09:04:59Z');
  const almostExpired = await read(handler);
  assert.equal(almostExpired.response.headers.get('Cache-Control'), 'public, max-age=1');
  current = new Date('2026-11-07T09:05:00Z');
  const refreshed = await read(handler);
  assert.equal(calls.length, 4);
  assert.equal(refreshed.data.updatedAt, '2026-11-07T09:05:00.000Z');
  await read(handler, request('?date=2026-11-09'));
  assert.equal(calls.length, 6);
});

test('deduplicates concurrent days in a week without sharing consumed response bodies', async () => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const calls = [];
  const inner = fixtureFetcher([meal()], [lesson()], calls);
  const handler = createSchoolHandler({ now: NOW, fetcher: async (...args) => { await ready; return inner(...args); } });
  const pending = [read(handler), read(handler, request('?date=2026-11-05')), read(handler, request('?date=2026-11-08'))];
  release();
  const results = await Promise.all(pending);
  assert.equal(calls.length, 2);
  assert.deepEqual(results[0].data, results[1].data);
  assert.deepEqual(results[1].data, results[2].data);
});

test('writes only public JSON to the supplied cache and can reuse it across handlers', async () => {
  const stored = new Map();
  const writes = [];
  const cache = {
    async match(req) { return stored.get(req.url)?.clone(); },
    async put(req, response) { writes.push({ url: req.url, body: await response.clone().text() }); stored.set(req.url, response.clone()); }
  };
  const calls = [];
  const first = createSchoolHandler({ now: NOW, cache, fetcher: fixtureFetcher([meal()], [lesson()], calls) });
  const { data } = await read(first);
  const second = createSchoolHandler({ now: NOW, cache, fetcher: async () => { throw new Error('cache should satisfy request'); } });
  assert.deepEqual((await read(second, request('?date=2026-11-04'))).data, data);
  assert.equal(calls.length, 2);
  assert.equal(writes.length, 1);
  assert.equal(new URL(writes[0].url).origin, 'https://classroom.example');
  assert.ok(!JSON.stringify(writes).includes(ENV.NEIS_API_KEY));
  assert.ok(!JSON.stringify(writes).includes('not-public'));
  assert.ok(writes[0].url.endsWith('?date=2026-11-02'));
});

test('cache failures and malformed cached bodies do not prevent live results', async () => {
  for (const cache of [
    { async match() { throw new Error('unavailable'); }, async put() { throw new Error('unavailable'); } },
    { async match() { return new Response('{bad'); }, async put() {} },
    { async match() { return json({ updatedAt: NOW().toISOString(), KEY: ENV.NEIS_API_KEY }); }, async put() {} }
  ]) {
    const { data } = await read(createSchoolHandler({ now: NOW, cache, fetcher: fixtureFetcher() }));
    assert.equal(data.meals.status, 'ok');
    assert.equal(data.timetable.status, 'ok');
    assert.ok(!JSON.stringify(data).includes(ENV.NEIS_API_KEY));
  }
});

test('does not cache transient partial errors or allow cached data to bypass missing configuration', async () => {
  let fail = true;
  const handler = createSchoolHandler({ now: NOW, fetcher: async input => {
    const service = new URL(input).pathname.split('/').at(-1);
    if (service === 'hisTimetable' && fail) throw new Error('temporary');
    return json(envelope(service, service === 'hisTimetable' ? [lesson()] : [meal()]));
  } });
  assert.equal((await read(handler)).data.timetable.status, 'error');
  fail = false;
  assert.equal((await read(handler)).data.timetable.status, 'ok');
  assert.equal((await read(handler, request(), {})).response.status, 503);
});
