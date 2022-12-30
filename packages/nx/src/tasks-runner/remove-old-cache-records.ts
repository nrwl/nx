import { readdirSync, statSync } from 'fs';
import { removeSync } from 'fs-extra';
import { join } from 'path';

const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7;

const folder = process.argv[2];

removeOld(terminalOutputs());
removeOld(cachedFiles());

function terminalOutputs() {
  try {
    return readdirSync(join(folder, 'terminalOutputs')).map((f) =>
      join(folder, 'terminalOutputs', f)
    );
  } catch (e) {
    return [];
  }
}

function cachedFiles() {
  try {
    return readdirSync(folder)
      .filter((f) => !f.endsWith('terminalOutputs'))
      .map((f) => join(folder, f));
  } catch (e) {
    return [];
  }
}

function removeOld(records: string[]) {
  try {
    const time = mostRecentMTime(records);

    records.forEach((r) => {
      try {
        const s = statSync(r);
        if (time - s.mtimeMs > WEEK_IN_MS) {
          if (s.isDirectory()) {
            try {
              removeSync(`${r}.commit`);
            } catch (e) {}
          }
          removeSync(r);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function mostRecentMTime(records: string[]) {
  let mostRecentTime = 0;
  records.forEach((r) => {
    try {
      const s = statSync(r);
      if (s.mtimeMs > mostRecentTime) {
        mostRecentTime = s.mtimeMs;
      }
    } catch (e) {}
  });
  return mostRecentTime;
}
