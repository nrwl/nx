import * as net from 'net';
import { logger } from '@nx/devkit';

export function waitForPortOpen(
  port: number,
  options: { host?: string; retries?: number; retryDelay?: number } = {}
): Promise<void> {
  const host = options.host ?? 'localhost';
  const allowedErrorCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'];

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
          if (process.env['NX_VERBOSE_LOGGING'] === 'true') {
            logger.info(
              `Error connecting on ${host}:${port}: ${err['code'] || err}`
            );
          }
          cleanupClient();
          reject(err);
        } else {
          setTimeout(() => checkPort(retries - 1), options.retryDelay ?? 1000);
        }
      });

      if (process.env['NX_VERBOSE_LOGGING'] === 'true') {
        logger.info(`Connecting on ${host}:${port}`);
      }
      client.connect({ port, host });
    };

    checkPort();
  });
}
