import fetch from 'node-fetch';

export async function isPackagerRunning(
  packagerPort: number
): Promise<'running' | 'not_running' | 'unrecognized'> {
  try {
    const resp = await fetch(`http://localhost:${packagerPort}/status`);
    const data = await resp.text();
    return data === 'packager-status:running' ? 'running' : 'unrecognized';
  } catch {
    return 'not_running';
  }
}
