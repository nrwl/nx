export function requireNx(): typeof import('nx/src/devkit-exports') {
  try {
    return require('nx/src/devkit-exports');
  } catch {
    return require('./nx-reexports-pre16');
  }
}
