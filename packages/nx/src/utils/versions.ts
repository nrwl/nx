import { extname } from 'path';

const isTS = extname(__filename) === '.ts';
const pathToPackageJson = isTS ? '../../package.json' : '../../../package.json';
const getNxVersion = () => {
  try {
    return require(pathToPackageJson).version;
  } catch {
    return require('nx/package.json').version;
  }
};
export const nxVersion = getNxVersion();
