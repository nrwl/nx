import * as path from 'path';
import * as fs from 'fs';
import browserslist = require('browserslist');

const VALID_BROWSERSLIST_FILES = ['.browserslistrc', 'browserslist'];

const ES5_BROWSERS = [
  'ie 10',
  'ie 11',
  'safari 11',
  'safari 11.1',
  'safari 12',
  'safari 12.1',
  'safari 13',
  'ios_saf 13.0',
  'ios_saf 13.3',
];

export function getTerserEcmaVersion(projectRoot: string): 2020 | 5 {
  let pathToBrowserslistFile = '';
  for (const browserslistFile of VALID_BROWSERSLIST_FILES) {
    const fullPathToFile = path.join(projectRoot, browserslistFile);
    if (fs.existsSync(fullPathToFile)) {
      pathToBrowserslistFile = fullPathToFile;
      break;
    }
  }

  if (!pathToBrowserslistFile) {
    return 2020;
  }

  const env = browserslist.loadConfig({ path: pathToBrowserslistFile });
  const browsers = browserslist(env);
  return browsers.some((b) => ES5_BROWSERS.includes(b)) ? 5 : 2020;
}
