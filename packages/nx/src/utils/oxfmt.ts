import * as path from 'path';
import { execFile } from 'child_process';
import { readModulePackageJson } from './package-json';

let cachedOxfmtBin: string | undefined;

export function getOxfmtBinPath(): string {
  if (cachedOxfmtBin) {
    return cachedOxfmtBin;
  }

  const { packageJson, path: packageJsonPath } = readModulePackageJson('oxfmt');
  const bin =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin['oxfmt'];
  cachedOxfmtBin = path.resolve(path.dirname(packageJsonPath), bin);

  return cachedOxfmtBin;
}

export function formatContentWithOxfmt(
  filepath: string,
  content: string
): Promise<string> {
  const oxfmtBin = getOxfmtBinPath();
  return new Promise((resolve, reject) => {
    const child = execFile(
      'node',
      [oxfmtBin, `--stdin-filepath=${filepath}`],
      { encoding: 'utf-8' as const, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      }
    );
    child.stdin.write(content);
    child.stdin.end();
  });
}
