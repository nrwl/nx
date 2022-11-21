import * as net from 'net';

export function waitUntilServerIsListening(port: number): Promise<void> {
  const allowedErrorCodes = ['ECONNREFUSED', 'ECONNRESET'];
  const maxAttempts = 25;
  let attempts = 0;
  const client = new net.Socket();
  const cleanup = () => {
    client.removeAllListeners('connect');
    client.removeAllListeners('error');
    client.end();
    client.destroy();
    client.unref();
  };

  return new Promise<void>((resolve, reject) => {
    const listen = () => {
      client.once('connect', () => {
        cleanup();
        resolve();
      });
      client.on('error', (err) => {
        if (
          attempts > maxAttempts ||
          !allowedErrorCodes.includes(err['code'])
        ) {
          cleanup();
          reject(err);
        } else {
          attempts++;
          setTimeout(listen, 100 * attempts);
        }
      });
      client.connect({ port, host: 'localhost' });
    };
    listen();
  });
}
