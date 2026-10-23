import test from 'node:test';
import assert from 'node:assert/strict';
import { requestNotificationApi } from '../src/lib/notification-api.ts';
const endpoint = 'https://chat.vintrastudio.com/api/notifications';

test('sends Firebase identity only to configured HTTPS API and reads result', async () => {
  let request;
  const result = await requestNotificationApi(
    'registerNotificationDevice',
    { token: 'ExpoPushToken[test]' },
    {
      endpoint,
      getToken: async () => 'signed-token',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return Response.json({ data: { registered: true } });
      },
    },
  );
  assert.deepEqual(result, { registered: true });
  assert.equal(request.url, endpoint);
  assert.equal(request.options.headers.Authorization, 'Bearer signed-token');
  assert.equal(request.options.redirect, 'error');
  assert.deepEqual(JSON.parse(request.options.body), {
    action: 'registerNotificationDevice',
    data: { token: 'ExpoPushToken[test]' },
  });
});
test('expired identity refreshes once and preserves announcement request id', async () => {
  const refreshed = [];
  const bodies = [];
  await requestNotificationApi(
    'queueAnnouncement',
    { requestId: 'stable-id' },
    {
      endpoint,
      getToken: async (refresh) => {
        refreshed.push(refresh);
        return 'token';
      },
      fetchImpl: async (_, options) => {
        bodies.push(options.body);
        return bodies.length === 1
          ? new Response(null, { status: 401 })
          : Response.json({ data: { id: 'job' } });
      },
    },
  );
  assert.deepEqual(refreshed, [false, true]);
  assert.equal(bodies[0], bodies[1]);
});
test('server setup, permission, malformed result and connection failures never report success', async () => {
  const checks = [
    [async () => new Response('not found', { status: 404 }), /not activated/],
    [
      async () =>
        Response.json({ error: { message: 'No access' } }, { status: 403 }),
      /No access/,
    ],
    [async () => Response.json({ unexpected: true }), /invalid response/],
    [
      async () => {
        throw new TypeError('Network request failed');
      },
      /Check your connection/,
    ],
  ];
  for (const [fetchImpl, expected] of checks)
    await assert.rejects(
      () =>
        requestNotificationApi(
          'notificationCenter',
          {},
          { endpoint, getToken: async () => 'token', fetchImpl },
        ),
      expected,
    );
});
test('rejects unsafe destination before fetching credentials', async () => {
  for (const endpoint of [
    'http://example.com/api',
    'https://name:password@example.com/api',
    'https://example.com/api?secret=x',
  ]) {
    await assert.rejects(
      () =>
        requestNotificationApi(
          'notificationCenter',
          {},
          {
            endpoint,
            getToken: async () => {
              throw new Error('must not run');
            },
          },
        ),
      /address is invalid/,
    );
  }
});
