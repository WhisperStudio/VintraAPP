type Dependencies = {
  endpoint: string;
  serviceName?: string;
  getToken: (refresh: boolean) => Promise<string>;
  fetchImpl?: typeof fetch;
};

export async function requestNotificationApi<T>(
  action: string,
  data: unknown,
  { endpoint, getToken, fetchImpl = fetch, serviceName = 'Notifications' }: Dependencies,
): Promise<T> {
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${serviceName}: the service address is invalid.`);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(attempt === 1);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetchImpl(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (response.status === 401 && attempt === 0) continue;
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 404 || response.status === 503) {
          throw new Error(
            `${serviceName} is not activated yet. Please try again later.`,
          );
        }
        throw new Error(
          result?.error?.message ||
            `Could not connect to ${serviceName.toLowerCase()}. Please try again.`,
        );
      }
      if (!result || !Object.prototype.hasOwnProperty.call(result, 'data')) {
        throw new Error(
          `${serviceName}: the service returned an invalid response.`,
        );
      }
      return result.data as T;
    } catch (error) {
      if (
        error instanceof TypeError ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw new Error(
          `Could not reach ${serviceName.toLowerCase()}. Check your connection and try again.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('Your session expired. Sign in again.');
}
