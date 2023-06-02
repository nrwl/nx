import * as net from 'net';

export function waitForPortOpen(
  port: number,
  options: { host?: string; retries?: number; retryDelay?: number } = {}
): Promise<void> {
  const allowedErrorCodes = ['ECONNREFUSED', 'ECONNRESET'];

  return new Promise((resolve, reject) => {
    const checkPort = (retries = options.retries ?? 120) => {
      const client = new net.Socket();
      const cleanupClient = () => {
        client.removeAllListeners('connect');
        client.removeAllListeners('error');
        client.end();
        client.destroy();
        client.unref();
      };
      client.once('connect', () => {
        cleanupClient();
        resolve();
      });

      client.once('error', (err) => {
        if (retries === 0 || !allowedErrorCodes.includes(err['code'])) {
          cleanupClient();
          reject(err);
        } else {
          setTimeout(() => checkPort(retries - 1), options.retryDelay ?? 1000);
        }
      });

      // Node will use IPv6 if it is available, but this can cause issues if the server is only listening on IPv4.
      // Hard-coding to look on 127.0.0.1 to avoid using the IPv6 loopback address "::1".
      client.connect({ port, host: options.host ?? '127.0.0.1' });
    };

    checkPort();
  });
}
