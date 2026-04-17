import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';

/**
 * Reserves a port across parallel processes on the same host via an atomic
 * lock file. Avoids the TOCTOU race of probing port 0 and then binding it
 * seconds later — another parallel process could be handed the same port in
 * between.
 */
const LOCK_DIR = process.env.NX_E2E_PORT_LOCK_DIR ?? '/tmp/nx-e2e-port-locks';
fs.mkdirSync(LOCK_DIR, { recursive: true });

export function reservePort(start = 4200): number {
  for (let port = start; port < 65000; port++) {
    const lock = path.join(LOCK_DIR, `${port}.lock`);
    try {
      fs.writeFileSync(lock, '', { flag: 'wx' });
      process.on('exit', () => {
        try {
          fs.unlinkSync(lock);
        } catch {}
      });
      return port;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error('No available ports');
}

/**
 * Reserves `count` ports.
 */
export function reservePorts(count: number): number[] {
  const ports: number[] = [];
  for (let i = 0; i < count; i++) {
    ports.push(reservePort());
  }
  return ports;
}

/**
 * @deprecated Use {@link reservePort} — probing the OS for port 0 opens a
 * TOCTOU race across parallel e2e processes. Kept for backwards compatibility.
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
 * @deprecated Use {@link reservePorts}.
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
