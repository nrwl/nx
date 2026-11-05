import { existsSync } from 'fs';

// `ts.sys.useCaseSensitiveFileNames` of TypeScript 6.
export function isFileSystemCaseSensitive(): boolean {
  if (process.platform === 'win32') {
    return false;
  }
  const swappedCase = __filename.replace(/\w/g, (ch) => {
    const upper = ch.toUpperCase();
    return ch === upper ? ch.toLowerCase() : upper;
  });
  return !existsSync(swappedCase);
}
