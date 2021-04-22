import { readdirSync, statSync } from 'fs';
import { removeSync } from 'fs-extra';
import { join } from 'path';

const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7;

const folder = process.argv[2];

removeOld(terminalOutputs());
removeOld(cachedFiles());

function terminalOutputs(): string[] {
  try {
    return readdirSync(join(folder, 'terminalOutputs'));
  } catch {
    return [];
  }
}

function cachedFiles(): string[] {
  try {
    return readdirSync(folder).filter((f) => !f.endsWith('terminalOutputs'));
  } catch {
    return [];
  }
}

function removeOld(records: string[]): void {
  try {
    const time = mostRecentMTime(records);

    records.forEach((r) => {
      const child = join(folder, r);
      try {
        const s = statSync(child);
        if (time - s.mtimeMs > WEEK_IN_MS) {
          if (s.isDirectory()) {
            removeSync(`${child}.commit`);
          }
          removeSync(child);
        }
      } catch {}
    });
  } catch {}
}

function mostRecentMTime(records: string[]): number {
  let mostRecentTime = 0;
  records.forEach((r) => {
    const child = join(folder, r);
    try {
      const s = statSync(child);
      if (s.mtimeMs > mostRecentTime) {
        mostRecentTime = s.mtimeMs;
      }
    } catch {}
  });
  return mostRecentTime;
}
