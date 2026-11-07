import { createSchoolHandler } from './school-api.mjs';

export function createFirebaseAdapter({ readKey = () => '', handler = createSchoolHandler() } = {}) {
  return async function firebaseAdapter(req, res) {
    try {
      // A fixed origin keeps the week cache independent of forwarded Host headers.
      const path = typeof req.originalUrl === 'string' && req.originalUrl.startsWith('/') ? req.originalUrl : '/';
      const request = new Request(`https://school.internal${path}`, { method: req.method });
      const response = await handler(request, { NEIS_API_KEY: readKey() });
      const body = Buffer.from(await response.arrayBuffer());
      res.statusCode = response.status;
      for (const [name, value] of response.headers) res.setHeader(name, value);
      res.end(body);
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '학교 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' } }));
    }
  };
}
