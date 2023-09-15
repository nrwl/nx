import * as net from 'net';

/**
 * Check if a port is currently active.
 * Retries and Retry Delay options are present for circumstances where a project may be built before the server is started.
 * This is useful to prevent multiple builds and an incorrect port conflict check.
 *
 * NOTE: The difference between `checkPortIsActive` and `waitForPortOpen` is that the latter expects the port to eventually be opened
 * and if it isn't, it will error.
 * `checkPortIsActive` should have the opposite logic, it should return false if the port is not open, and true if it is.
 * @param options
 */
export function checkPortIsActive(options: {
  port: number;
  host?: string;
  retries?: number;
  retryDelay?: number;
}): Promise<boolean> {
  const allowedErrorCodes = ['ECONNREFUSED', 'ECONNRESET'];

  return new Promise((resolve, reject) => {
    const checkPort = (retries = options.retries ?? 60) => {
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
        resolve(true);
      });

      client.once('error', (err) => {
        if (retries === 0 && allowedErrorCodes.includes(err['code'])) {
          cleanupClient();
          resolve(false);
        } else if (retries === 0 && !allowedErrorCodes.includes(err['code'])) {
          cleanupClient();
          reject(err);
        } else {
          setTimeout(() => checkPort(retries - 1), options.retryDelay ?? 1000);
        }
      });

      // Node will use IPv6 if it is available, but this can cause issues if the server is only listening on IPv4.
      // Hard-coding to look on 127.0.0.1 to avoid using the IPv6 loopback address "::1".
      client.connect({ port: options.port, host: options.host ?? '127.0.0.1' });
    };

    checkPort();
  });
}
