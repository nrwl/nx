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

      client.connect({ port, host: options.host ?? 'localhost' });
    };

    checkPort();
  });
}
