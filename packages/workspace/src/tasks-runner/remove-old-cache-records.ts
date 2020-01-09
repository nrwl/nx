import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as path from 'path';

const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7;

const folder = process.argv[2];

removeOld(terminalOutputs());
removeOld(cachedFiles());

function terminalOutputs() {
  try {
    return fs.readdirSync(path.join(folder, 'terminalOutputs'));
  } catch (e) {
    return [];
  }
}

function cachedFiles() {
  try {
    return fs.readdirSync(folder).filter(f => !f.endsWith('terminalOutputs'));
  } catch (e) {
    return [];
  }
}

function removeOld(records: string[]) {
  try {
    const time = mostRecentMTime(records);

    records.forEach(r => {
      const child = path.join(folder, r);
      try {
        const s = fs.statSync(child);
        if (time - s.mtimeMs > WEEK_IN_MS) {
          if (s.isDirectory()) {
            try {
              fsExtra.removeSync(`${child}.commit`);
            } catch (e) {}
          }
          fsExtra.removeSync(child);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function mostRecentMTime(records: string[]) {
  let mostRecentTime = 0;
  records.forEach(r => {
    const child = path.join(folder, r);
    try {
      const s = fs.statSync(child);
      if (s.mtimeMs > mostRecentTime) {
        mostRecentTime = s.mtimeMs;
      }
    } catch (e) {}
  });
  return mostRecentTime;
}
