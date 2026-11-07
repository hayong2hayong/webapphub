import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todayInKorea, dateBounds, isSelectableDate, moveDate, weekForDate,
  mealsForDate, groupTimetable, createWeekLoader,
} from '../dist/apps/school-life/school-core.mjs';

const now = new Date('2026-11-07T01:00:00Z');
const payload = (start = '2026-11-02') => {
  const dates = start === '2026-11-02'
    ? ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
    : ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  return {
    school: { name: '한솔고등학교', educationCode: 'I10', schoolCode: '9300058' },
    grade: 2, className: '8', week: { start, end: dates[6], dates },
    updatedAt: '2026-11-07T01:00:00.000Z',
    meals: { status: 'empty', rows: [] }, timetable: { status: 'empty', rows: [] },
  };
};
const response = data => ({ ok: true, json: async () => data });

test('Korean today changes at midnight in Korea, including the new year', () => {
  assert.equal(todayInKorea(new Date('2026-11-06T14:59:59Z')), '2026-11-06');
  assert.equal(todayInKorea(new Date('2026-11-06T15:00:00Z')), '2026-11-07');
  assert.equal(todayInKorea(new Date('2026-12-31T15:00:00Z')), '2027-01-01');
});

test('selectable dates reject impossible dates and enforce Korean current year plus or minus one', () => {
  assert.deepEqual(dateBounds(now), { min: '2025-01-01', max: '2027-12-31' });
  assert.equal(isSelectableDate('2026-02-29', now), false);
  assert.equal(isSelectableDate('2026-11-31', now), false);
  assert.equal(isSelectableDate('2026-1-07', now), false);
  assert.equal(isSelectableDate('2024-12-31', now), false);
  assert.equal(isSelectableDate('2028-01-01', now), false);
  assert.equal(isSelectableDate('2025-01-01', now), true);
  assert.equal(isSelectableDate('2027-12-31', now), true);
  assert.equal(isSelectableDate('2028-02-29', new Date('2027-06-01T00:00:00Z')), true);
});

test('Sunday belongs to the preceding Monday week across a year boundary', () => {
  assert.deepEqual(weekForDate('2027-01-03'), {
    start: '2026-12-28', end: '2027-01-03',
    dates: ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'],
  });
  assert.equal(moveDate('2026-12-31', 1), '2027-01-01');
  assert.equal(moveDate('2026-03-01', -1), '2026-02-28');
});

test('selected meals are date-specific and keep allergy markers while sorting meal types', () => {
  const rows = [
    { date: '2026-11-06', typeCode: '3', typeName: '석식', dishes: ['밥'], calories: '700 Kcal' },
    { date: '2026-11-05', typeCode: '2', typeName: '중식', dishes: ['다른 날'], calories: '' },
    { date: '2026-11-06', typeCode: '2', typeName: '중식', dishes: ['우유 (2.)', '국 (5.6.9.)'], calories: '600 Kcal' },
  ];
  assert.deepEqual(mealsForDate(rows, '2026-11-06').map(row => [row.typeName, row.dishes]), [
    ['중식', ['우유 (2.)', '국 (5.6.9.)']], ['석식', ['밥']],
  ]);
  assert.deepEqual(mealsForDate(rows, '2026-11-07'), []);
  assert.equal(rows[0].typeName, '석식');
});

test('weekly timetable sorts periods numerically and preserves parallel courses in the same cell', () => {
  const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  const first = { date: dates[0], period: '2', subject: '물리학Ⅰ', classroom: '과학실', course: '자연', department: '' };
  const second = { date: dates[0], period: '2', subject: '경제', classroom: '2-8', course: '인문', department: '사회' };
  const grouped = groupTimetable([
    { date: dates[1], period: '10', subject: '자율' }, first, second,
    { date: dates[0], period: '1', subject: '국어' },
    { date: '2026-11-07', period: '1', subject: '주말' },
    { date: '2026-11-09', period: '1', subject: '다음 주' },
  ], dates);
  assert.deepEqual(grouped.periods, ['1', '2', '10']);
  assert.deepEqual(grouped.days[0].cells.get('2'), [first, second]);
  assert.deepEqual(grouped.days[2].cells.get('2'), []);
  assert.equal(grouped.days.length, 5);
});

test('same-week navigation reuses a result for five minutes, then refreshes it', async () => {
  let clock = 0;
  const urls = [];
  const loader = createWeekLoader({ now: () => clock, fetcher: async url => {
    urls.push(url);
    return response(payload());
  } });
  assert.equal((await loader.load('2026-11-02')).kind, 'ready');
  assert.equal((await loader.load('2026-11-08')).cached, true);
  assert.deepEqual(urls, ['/api/school-week?date=2026-11-02']);
  clock = 300_000;
  assert.equal((await loader.load('2026-11-06')).cached, false);
  assert.deepEqual(urls, ['/api/school-week?date=2026-11-02', '/api/school-week?date=2026-11-06']);
});
test('server-cached data keeps its original expiry instead of gaining another five minutes', async () => {
  const origin = Date.parse('2026-11-07T01:00:00.000Z');
  let clock = origin + 299_000;
  let calls = 0;
  const loader = createWeekLoader({ now: () => clock, fetcher: async () => {
    calls++;
    return { ...response(payload()), headers: new Headers({ 'Cache-Control': 'public, max-age=1' }) };
  } });
  assert.equal((await loader.load('2026-11-06')).kind, 'ready');
  clock += 2_000;
  assert.equal((await loader.load('2026-11-07')).cached, false);
  assert.equal(calls, 2);
});

test('a late older response cannot replace the selected week even if fetch ignores abort', async () => {
  const pending = [];
  const loader = createWeekLoader({ fetcher: (url, options) => new Promise(resolve => pending.push({ url, options, resolve })) });
  const older = loader.load('2026-11-06');
  const newer = loader.load('2026-11-09');
  assert.equal(pending[0].options.signal.aborted, true);
  pending[1].resolve(response(payload('2026-11-09')));
  const latest = await newer;
  assert.equal(latest.kind, 'ready');
  assert.equal(latest.date, '2026-11-09');
  assert.equal(latest.data.week.start, '2026-11-09');
  pending[0].resolve(response(payload()));
  assert.deepEqual(await older, { kind: 'stale', date: '2026-11-06' });
});

test('a new-week failure carries the requested date and never returns old-week data', async () => {
  const loader = createWeekLoader({ fetcher: async url => {
    if (url.endsWith('2026-11-06')) return response(payload());
    throw new Error('private upstream details');
  } });
  await loader.load('2026-11-06');
  assert.deepEqual(await loader.load('2026-11-09'), { kind: 'error', date: '2026-11-09', code: 'NETWORK_ERROR' });
});

test('retry bypasses cached partial failure and configuration errors expose only a safe code', async () => {
  let attempts = 0;
  const loader = createWeekLoader({ fetcher: async () => {
    attempts++;
    if (attempts === 1) {
      const partial = payload();
      partial.meals = { status: 'error', message: '일부 자료를 가져오지 못했어요.', rows: [] };
      return response(partial);
    }
    return { ok: false, json: async () => ({ error: { code: 'NOT_CONFIGURED', message: 'private server settings' } }) };
  } });
  assert.equal((await loader.load('2026-11-06')).data.meals.status, 'error');
  assert.deepEqual(await loader.load('2026-11-06', { force: true }), { kind: 'error', date: '2026-11-06', code: 'NOT_CONFIGURED' });
});

test('a response for another week is rejected instead of being labeled with the requested date', async () => {
  const loader = createWeekLoader({ fetcher: async () => response(payload()) });
  assert.deepEqual(await loader.load('2026-11-09'), { kind: 'error', date: '2026-11-09', code: 'INVALID_RESPONSE' });
});
