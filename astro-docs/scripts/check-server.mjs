import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function waitForServer(url, timeout = 120000) {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Math.min(5000, deadline - Date.now())),
      });
      await response.body?.cancel();
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await setTimeout(Math.max(0, Math.min(1000, deadline - Date.now())));
  }

  throw new Error(
    `Server at ${url} did not become ready within ${timeout / 1000} seconds: ${lastError?.message}`,
    { cause: lastError }
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await waitForServer(process.argv[2], 5000);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
