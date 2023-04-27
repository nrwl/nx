import { extname } from 'path';

const binaryExtensions = new Set([
  // // Image types originally from https://github.com/sindresorhus/image-type/blob/5541b6a/index.js
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.flif',
  '.cr2',
  '.tif',
  '.bmp',
  '.jxr',
  '.psd',
  '.ico',
  '.bpg',
  '.jp2',
  '.jpm',
  '.jpx',
  '.heic',
  '.cur',
  '.avif',
  '.dcm',

  // Compressed files
  '.tgz',
  '.gz',
  '.zip',

  // Documents
  '.pdf',

  // Java files
  '.jar',
  '.keystore',

  // Font files
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',

  // Misc files
  '.pxd',
  '.pxz',
]);

export function isBinaryPath(path: string): boolean {
  return binaryExtensions.has(extname(path));
}
