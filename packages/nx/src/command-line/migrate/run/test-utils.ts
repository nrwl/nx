import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FileLock } from '../../../native';
import { brokerDir } from './broker';

// Holds the session lock as a live parent would, answers whichever request
// the run under test publishes, then settles with it.
export async function answered<T>(
  dir: string,
  nonce: string,
  result: object,
  start: () => Promise<T>
): Promise<T> {
  const requestsDir = brokerDir(dir);
  mkdirSync(requestsDir, { recursive: true });
  const lock = new FileLock(join(requestsDir, `${nonce}.lock`));
  lock.lock();
  const pending = start();
  let settled = false;
  const watched = pending.then(
    () => (settled = true),
    () => (settled = true)
  );
  try {
    for (let i = 0; i < 500 && !settled; i++) {
      const request = readdirSync(requestsDir).find((f) =>
        f.endsWith('.request.json')
      );
      if (request) {
        writeFileSync(
          join(requestsDir, request.replace('.request.json', '.result.json')),
          JSON.stringify(result)
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } finally {
    lock.unlock();
  }
  await watched;
  return pending;
}

export function readRequest(dir: string): object {
  const requestsDir = brokerDir(dir);
  const request = readdirSync(requestsDir).find((f) =>
    f.endsWith('.request.json')
  );
  return JSON.parse(readFileSync(join(requestsDir, request), 'utf8'));
}
