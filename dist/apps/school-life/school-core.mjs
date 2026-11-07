const DAY = 86_400_000;
const KOREA_OFFSET = 9 * 60 * 60 * 1000;

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

export function todayInKorea(now = new Date()) {
  return new Date(new Date(now).getTime() + KOREA_OFFSET).toISOString().slice(0, 10);
}

export function dateBounds(now = new Date()) {
  const year = Number(todayInKorea(now).slice(0, 4));
  return { min: `${year - 1}-01-01`, max: `${year + 1}-12-31` };
}

export function isSelectableDate(value, now = new Date()) {
  const bounds = dateBounds(now);
  return Boolean(calendarDate(value)) && value >= bounds.min && value <= bounds.max;
}

export function moveDate(value, days) {
  const parsed = calendarDate(value);
  if (!parsed || !Number.isInteger(days)) throw new RangeError('Invalid calendar date');
  return new Date(parsed.getTime() + days * DAY).toISOString().slice(0, 10);
}

export function weekForDate(value) {
  const parsed = calendarDate(value);
  if (!parsed) throw new RangeError('Invalid calendar date');
  const start = moveDate(value, -((parsed.getUTCDay() + 6) % 7));
  const dates = Array.from({ length: 7 }, (_, index) => moveDate(start, index));
  return { start, end: dates[6], dates };
}

export function mealsForDate(rows, date) {
  return rows.filter(row => row.date === date).sort((a, b) => Number(a.typeCode) - Number(b.typeCode));
}

export function groupTimetable(rows, dates) {
  const days = dates.map(date => ({ date, cells: new Map() }));
  const lookup = new Map(days.map(day => [day.date, day]));
  const periods = new Set();
  for (const row of rows) {
    const day = lookup.get(row.date);
    const period = String(Number(row.period));
    if (!day || !/^\d+$/.test(period) || Number(period) < 1) continue;
    periods.add(period);
    if (!day.cells.has(period)) day.cells.set(period, []);
    day.cells.get(period).push(row);
  }
  const ordered = [...periods].sort((a, b) => Number(a) - Number(b));
  for (const day of days) for (const period of ordered) if (!day.cells.has(period)) day.cells.set(period, []);
  return { periods: ordered, days };
}

function matchesWeek(data, date) {
  const expected = weekForDate(date);
  return data?.week?.start === expected.start && data.week.end === expected.end
    && Array.isArray(data.week.dates) && data.week.dates.length === 7
    && expected.dates.every((value, index) => data.week.dates[index] === value)
    && ['meals', 'timetable'].every(name =>
      ['ok', 'empty', 'error'].includes(data[name]?.status) && Array.isArray(data[name].rows));
}

export function createWeekLoader({ fetcher = (url, options) => fetch(url, options), now = () => Date.now(), ttl = 300_000 } = {}) {
  const cache = new Map();
  let generation = 0;
  let controller;
  return {
    async load(date, { force = false } = {}) {
      const requestGeneration = ++generation;
      controller?.abort();
      controller = undefined;
      let week;
      try { week = weekForDate(date); }
      catch { return { kind: 'error', date, code: 'INVALID_DATE' }; }
      const cached = cache.get(week.start);
      if (!force && cached && now() >= cached.receivedAt && now() < cached.expiresAt) {
        return { kind: 'ready', date, data: cached.data, cached: true };
      }
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const result = await fetcher(`/api/school-week?date=${encodeURIComponent(date)}`, { signal, headers: { Accept: 'application/json' } });
        const data = await result.json();
        if (requestGeneration !== generation) return { kind: 'stale', date };
        if (!result.ok) {
          return { kind: 'error', date, code: data?.error?.code === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'HTTP_ERROR' };
        }
        if (!matchesWeek(data, date)) return { kind: 'error', date, code: 'INVALID_RESPONSE' };
        const receivedAt = now();
        const timestamp = Date.parse(data.updatedAt);
        let expiresAt = Math.min(receivedAt + ttl, Number.isFinite(timestamp) ? timestamp + ttl : receivedAt);
        const maxAge = result.headers?.get?.('cache-control')?.match(/(?:^|,)\s*max-age=(\d+)/i);
        if (maxAge) expiresAt = Math.min(expiresAt, receivedAt + Math.max(0, Number(maxAge[1]) - Number(result.headers.get('age') || 0)) * 1000);
        if (expiresAt > receivedAt && data.meals.status !== 'error' && data.timetable.status !== 'error') {
          cache.set(week.start, { data, receivedAt, expiresAt });
        }
        if (cache.size > 12) cache.delete(cache.keys().next().value);
        return { kind: 'ready', date, data, cached: false };
      } catch {
        if (requestGeneration !== generation) return { kind: 'stale', date };
        return { kind: 'error', date, code: 'NETWORK_ERROR' };
      }
    },
  };
}
