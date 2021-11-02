export function importConstants() {
  try {
    return require('next/dist/next-server/lib/constants');
  } catch {
    return require('next/dist/shared/lib/constants');
  }
}

export function importConfig() {
  try {
    return require('next/dist/next-server/lib/config').default;
  } catch {
    return require('next/dist/server/config').default;
  }
}
