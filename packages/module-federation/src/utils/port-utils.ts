import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';

/**
 * Check if a port is already in use by attempting to connect to it.
 * Uses waitForPortOpen with retries: 0 for an immediate check.
 */
export async function isPortInUse(
  port: number,
  host: string = '127.0.0.1'
): Promise<boolean> {
  try {
    await waitForPortOpen(port, { retries: 0, host });
    return true; // Port is open/in use
  } catch {
    return false; // Port is not in use
  }
}
