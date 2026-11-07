const SCHOOL = { name: '한솔고등학교', educationCode: 'I10', schoolCode: '9300058' };
const DAY_MS = 86_400_000;
const CACHE_MS = 300_000;
const PAGE_SIZE = 1000;
const MAX_ROWS = 2000;
const REQUEST_TIMEOUT_MS = 8000;
const PANEL_MESSAGES = {
  auth: '학교 정보 인증 설정을 확인해 주세요.',
  network: '학교 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  format: '학교 정보 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'
};

function responseJSON(value, status = 200, cacheable = false, headers = {}) {
  return new Response(typeof value === 'string' ? value : JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheable ? 'public, max-age=300' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

function errorResponse(status, code, message, headers) {
  return responseJSON({ error: { code, message } }, status, false, headers);
}

function remainingCacheHeaders(timestamp, current) {
  const seconds = Math.max(0, Math.min(300, Math.ceil((timestamp + CACHE_MS - current.getTime()) / 1000)));
  return { 'Cache-Control': `public, max-age=${seconds}` };
}

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && isoDate(date) === value ? date : null;
}

function weekFor(date) {
  const monday = date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS;
  const dates = Array.from({ length: 7 }, (_, index) => isoDate(new Date(monday + index * DAY_MS)));
  return { start: dates[0], end: dates[6], dates };
}

function safeText(value, key) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  let text = String(value);
  // Even an upstream echo in an otherwise public field must not disclose the key.
  for (const secret of new Set([key, encodeURIComponent(key)])) {
    if (secret) text = text.split(secret).join('[비공개]');
  }
  return text.replace(/<[^>]*>/g, '').trim();
}

function rowDate(value, week) {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return calendarDate(iso) && iso >= week.start && iso <= week.end ? iso : null;
}

function matchesSchool(row) {
  return row && typeof row === 'object' && String(row.ATPT_OFCDC_SC_CODE) === SCHOOL.educationCode && String(row.SD_SCHUL_CODE) === SCHOOL.schoolCode;
}

function mealRows(rows, week, key) {
  const result = [];
  for (const row of rows) {
    if (!matchesSchool(row)) continue;
    const date = rowDate(row.MLSV_YMD, week);
    const typeCode = String(row.MMEAL_SC_CODE);
    if (!date || !['1', '2', '3'].includes(typeCode) || typeof row.DDISH_NM !== 'string') continue;
    result.push({
      date,
      typeCode,
      typeName: safeText(row.MMEAL_SC_NM, key) || ({ 1: '조식', 2: '중식', 3: '석식' })[typeCode],
      dishes: row.DDISH_NM.split(/<br\b[^>]*>/gi).map(dish => safeText(dish, key)).filter(Boolean),
      calories: safeText(row.CAL_INFO, key)
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || Number(a.typeCode) - Number(b.typeCode));
}

function timetableRows(rows, week, key) {
  const result = [];
  for (const row of rows) {
    if (!matchesSchool(row) || String(row.GRADE) !== '2' || String(row.CLASS_NM) !== '8') continue;
    const date = rowDate(row.ALL_TI_YMD, week);
    const period = Number(row.PERIO);
    const subject = safeText(row.ITRT_CNTNT, key);
    if (!date || !Number.isSafeInteger(period) || period < 1 || !subject) continue;
    result.push({ date, period, subject, classroom: safeText(row.CLRM_NM, key), course: safeText(row.ORD_SC_NM, key), department: safeText(row.DDDEP_NM, key) });
  }
  // Stable sorting retains separate subjects and rooms at the same period.
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
}

function upstreamError(code) {
  return { kind: ['ERROR-200', 'ERROR-290', 'ERROR-300', 'INFO-100'].includes(code) ? 'auth' : 'format' };
}

function parsePage(data, service) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw { kind: 'format' };
  if (data.RESULT) {
    if (data.RESULT.CODE === 'INFO-200') return { total: 0, rows: [] };
    throw upstreamError(data.RESULT.CODE);
  }
  const sections = data[service];
  if (!Array.isArray(sections)) throw { kind: 'format' };
  const head = sections.find(section => Array.isArray(section?.head))?.head;
  const rows = sections.find(section => Array.isArray(section?.row))?.row;
  if (!head || !rows) throw { kind: 'format' };
  const result = head.find(item => item?.RESULT)?.RESULT;
  if (result && result.CODE !== 'INFO-000') {
    if (result.CODE === 'INFO-200') return { total: 0, rows: [] };
    throw upstreamError(result.CODE);
  }
  const total = head.find(item => Object.hasOwn(item ?? {}, 'list_total_count'))?.list_total_count;
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_ROWS) throw { kind: 'format' };
  return { total, rows };
}

async function fetchPage(fetcher, url, service) {
  const controller = new AbortController();
  let timer;
  try {
    const data = await Promise.race([
      (async () => {
        let response;
        try {
          // NEIS selects JSON through Type=json; a JSON-only Accept header can return HTTP 500.
          // Workers support manual/follow only. Reject a redirect via response.ok below.
          response = await fetcher(url.toString(), { signal: controller.signal, redirect: 'manual', headers: { Accept: '*/*' } });
        } catch {
          throw { kind: 'network' };
        }
        if (!response?.ok) throw { kind: 'network' };
        try { return await response.json(); } catch { throw { kind: 'format' }; }
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject({ kind: 'network' }); }, REQUEST_TIMEOUT_MS);
      })
    ]);
    return parsePage(data, service);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPanel(fetcher, service, week, key) {
  try {
    const collected = [];
    let expectedTotal;
    for (let page = 1; page <= MAX_ROWS / PAGE_SIZE; page++) {
      const url = new URL(`https://open.neis.go.kr/hub/${service}`);
      const rangePrefix = service === 'hisTimetable' ? 'TI' : 'MLSV';
      const params = {
        KEY: key, Type: 'json', pIndex: String(page), pSize: String(PAGE_SIZE),
        ATPT_OFCDC_SC_CODE: SCHOOL.educationCode, SD_SCHUL_CODE: SCHOOL.schoolCode,
        [`${rangePrefix}_FROM_YMD`]: week.start.replaceAll('-', ''),
        [`${rangePrefix}_TO_YMD`]: week.end.replaceAll('-', '')
      };
      if (service === 'hisTimetable') Object.assign(params, { GRADE: '2', CLASS_NM: '8' });
      url.search = new URLSearchParams(params).toString();
      const { total, rows } = await fetchPage(fetcher, url, service);
      if (expectedTotal === undefined) expectedTotal = total;
      if (total !== expectedTotal || rows.length !== Math.min(PAGE_SIZE, total - collected.length)) throw { kind: 'format' };
      collected.push(...rows);
      if (collected.length === total) {
        const normalized = service === 'hisTimetable' ? timetableRows(collected, week, key) : mealRows(collected, week, key);
        return { status: normalized.length ? 'ok' : 'empty', rows: normalized };
      }
    }
    throw { kind: 'format' };
  } catch (error) {
    return { status: 'error', message: PANEL_MESSAGES[error?.kind] ?? PANEL_MESSAGES.network, rows: [] };
  }
}

function cleanCachedPanel(panel, kind, week, key) {
  if (!panel || !['ok', 'empty'].includes(panel.status) || !Array.isArray(panel.rows) || panel.rows.length > MAX_ROWS) return null;
  const rows = [];
  for (const row of panel.rows) {
    if (!row || !week.dates.includes(row.date)) return null;
    if (kind === 'meals') {
      if (!['1', '2', '3'].includes(row.typeCode) || !Array.isArray(row.dishes) || !row.dishes.every(value => typeof value === 'string') || typeof row.typeName !== 'string' || typeof row.calories !== 'string') return null;
      rows.push({ date: row.date, typeCode: row.typeCode, typeName: safeText(row.typeName, key), dishes: row.dishes.map(value => safeText(value, key)), calories: safeText(row.calories, key) });
    } else {
      if (!Number.isSafeInteger(row.period) || row.period < 1 || !['subject', 'classroom', 'course', 'department'].every(field => typeof row[field] === 'string')) return null;
      rows.push({ date: row.date, period: row.period, subject: safeText(row.subject, key), classroom: safeText(row.classroom, key), course: safeText(row.course, key), department: safeText(row.department, key) });
    }
  }
  if ((panel.status === 'empty') !== (rows.length === 0)) return null;
  return { status: panel.status, rows };
}

function cleanCachedPayload(data, week, current, key) {
  if (!data || data.school?.name !== SCHOOL.name || data.school?.schoolCode !== SCHOOL.schoolCode || data.school?.educationCode !== SCHOOL.educationCode || data.grade !== 2 || data.className !== '8' || data.week?.start !== week.start || data.week?.end !== week.end || JSON.stringify(data.week?.dates) !== JSON.stringify(week.dates)) return null;
  const timestamp = Date.parse(data.updatedAt);
  if (!Number.isFinite(timestamp) || timestamp > current.getTime() || current.getTime() - timestamp >= CACHE_MS) return null;
  const meals = cleanCachedPanel(data.meals, 'meals', week, key);
  const timetable = cleanCachedPanel(data.timetable, 'timetable', week, key);
  if (!meals || !timetable) return null;
  return { school: { ...SCHOOL }, grade: 2, className: '8', week, updatedAt: new Date(timestamp).toISOString(), meals, timetable };
}

export function createSchoolHandler({ fetcher = fetch, now = () => new Date(), cache } = {}) {
  const publicCache = cache ?? globalThis.caches?.default;
  const memory = new Map();
  const inFlight = new Map();

  return async function schoolHandler(request, env = {}, ctx) {
    if (request.method !== 'GET') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'GET 요청만 사용할 수 있습니다.', { Allow: 'GET' });
    const url = new URL(request.url);
    if (url.pathname !== '/api/school-week') return errorResponse(404, 'NOT_FOUND', '요청한 주소를 찾을 수 없습니다.');
    if ([...url.searchParams.keys()].some(name => name !== 'date') || url.searchParams.getAll('date').length > 1) return errorResponse(400, 'INVALID_QUERY', '날짜만 지정해 주세요.');
    const current = now();
    const today = isoDate(new Date(current.getTime() + 9 * 60 * 60 * 1000));
    const date = calendarDate(url.searchParams.has('date') ? url.searchParams.get('date') : today);
    if (!date || Math.abs(date.getUTCFullYear() - Number(today.slice(0, 4))) > 1) return errorResponse(400, 'INVALID_DATE', '올바른 날짜를 현재 연도의 앞뒤 1년 범위에서 선택해 주세요.');
    const key = typeof env?.NEIS_API_KEY === 'string' ? env.NEIS_API_KEY.trim() : '';
    if (!key) return errorResponse(503, 'NOT_CONFIGURED', '학교 정보 서비스가 아직 준비되지 않았습니다.');
    const week = weekFor(date);
    const cacheRequest = new Request(`${url.origin}/api/school-week?date=${week.start}`);
    const cacheKey = cacheRequest.url;

    const cached = memory.get(cacheKey);
    if (cached && current.getTime() - cached.timestamp < CACHE_MS && current.getTime() >= cached.timestamp) return responseJSON(cached.body, 200, true, remainingCacheHeaders(cached.timestamp, current));
    memory.delete(cacheKey);

    if (!inFlight.has(cacheKey)) {
      const operation = (async () => {
        if (publicCache) {
          try {
            const response = await publicCache.match(cacheRequest);
            if (response?.ok) {
              const payload = cleanCachedPayload(await response.json(), week, current, key);
              if (payload) return { body: JSON.stringify(payload), cacheable: true, timestamp: Date.parse(payload.updatedAt) };
            }
          } catch { /* Cache availability never prevents a live request. */ }
        }
        const [meals, timetable] = await Promise.all([
          fetchPanel(fetcher, 'mealServiceDietInfo', week, key),
          fetchPanel(fetcher, 'hisTimetable', week, key)
        ]);
        const payload = { school: { ...SCHOOL }, grade: 2, className: '8', week, updatedAt: current.toISOString(), meals, timetable };
        const body = JSON.stringify(payload);
        const cacheable = meals.status !== 'error' && timetable.status !== 'error';
        if (cacheable && publicCache) {
          try { await publicCache.put(cacheRequest, responseJSON(body, 200, true, remainingCacheHeaders(current.getTime(), now()))); } catch { /* A failed write has no effect on public data. */ }
        }
        return { body, cacheable, timestamp: current.getTime() };
      })();
      inFlight.set(cacheKey, operation);
      operation.finally(() => { if (inFlight.get(cacheKey) === operation) inFlight.delete(cacheKey); }).catch(() => {});
    }
    const result = await inFlight.get(cacheKey);
    if (result.cacheable) {
      memory.set(cacheKey, { body: result.body, timestamp: result.timestamp });
      if (memory.size > 160) memory.delete(memory.keys().next().value);
    }
    return responseJSON(result.body, 200, result.cacheable, result.cacheable ? remainingCacheHeaders(result.timestamp, now()) : {});
  };
}
