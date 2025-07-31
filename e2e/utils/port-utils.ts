import * as net from 'net';

/**
 * Finds an available port by creating a temporary server on port 0
 * and letting the OS assign a free port.
 */
export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);

    server.listen(0, () => {
      const addressInfo = server.address();
      if (!addressInfo || typeof addressInfo === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      const port = addressInfo.port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

/**
 * Finds multiple available ports for running multiple services
 *
 * @param count - Number of ports needed
 * @returns Promise<number[]> - Array of available port numbers
 */
export async function getAvailablePorts(count: number): Promise<number[]> {
  const ports: number[] = [];
  for (let i = 0; i < count; i++) {
    const port = await getAvailablePort();
    ports.push(port);
  }
  return ports;
}

/**
 * Checks if a specific port is available
 *
 * @param port - Port number to check
 * @returns Promise<boolean> - True if port is available, false otherwise
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}
