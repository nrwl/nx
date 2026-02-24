import { machineId } from 'node-machine-id';

let _cachedMachineId: string | null = null;

/**
 * Get the current machine ID, with caching and error handling
 * @returns The machine ID or empty string if unable to retrieve
 */
export async function getCurrentMachineId(): Promise<string> {
  if (_cachedMachineId === null) {
    try {
      _cachedMachineId = await machineId();
    } catch (e) {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(`Unable to get machineId. Error: ${e.message}`);
      }
      _cachedMachineId = '';
    }
  }
  return _cachedMachineId;
}
