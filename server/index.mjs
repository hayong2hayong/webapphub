import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createFirebaseAdapter } from './firebase-adapter.mjs';

const neisApiKey = defineSecret('NEIS_API_KEY');
const adapter = createFirebaseAdapter({ readKey: () => neisApiKey.value() });

export const schoolWeek = onRequest({
  region: 'asia-east1',
  invoker: 'public',
  secrets: [neisApiKey],
  minInstances: 0,
  maxInstances: 1,
  concurrency: 40,
  cpu: 1,
  memory: '256MiB',
  timeoutSeconds: 30
}, adapter);
