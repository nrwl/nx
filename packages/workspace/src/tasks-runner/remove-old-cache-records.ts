import { readdirSync, removeSync, statSync } from 'fs-extra';
import * as path from 'path';

const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7;

const folder = process.argv[2];

removeOld(terminalOutputs());
removeOld(cachedFiles());

function terminalOutputs() {
  try {
    return readdirSync(path.join(folder, 'terminalOutputs'));
  } catch (e) {
    return [];
  }
}

function cachedFiles() {
  try {
    return readdirSync(folder).filter((f) => !f.endsWith('terminalOutputs'));
  } catch (e) {
    return [];
  }
}

function removeOld(records: string[]) {
  try {
    const time = mostRecentMTime(records);

    records.forEach((r) => {
      const child = path.join(folder, r);
      try {
        const s = statSync(child);
        if (time - s.mtimeMs > WEEK_IN_MS) {
          if (s.isDirectory()) {
            try {
              removeSync(`${child}.commit`);
            } catch (e) {}
          }
          removeSync(child);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function mostRecentMTime(records: string[]) {
  let mostRecentTime = 0;
  records.forEach((r) => {
    const child = path.join(folder, r);
    try {
      const s = statSync(child);
      if (s.mtimeMs > mostRecentTime) {
        mostRecentTime = s.mtimeMs;
      }
    } catch (e) {}
  });
  return mostRecentTime;
}
