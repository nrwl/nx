// After Nx v18, this can be removed and replaced with either:
// - import {} from 'nx/src/devkit-exports'
// - import {} from 'nx/src/devkit-internals'
export function requireNx(): typeof import('nx/src/devkit-exports') &
  Partial<typeof import('nx/src/devkit-internals')> {
  try {
    let result = { ...require('nx/src/devkit-exports') };
    try {
      result = {
        ...result,
        // Remove in Nx v18, devkit should not support Nx v16.0.2 at that point.
        ...require('nx/src/devkit-internals'),
      };
    } catch {}
    return result;
  } catch {
    // Remove in Nx V17, devkit should not support Nx < 16 at that point.
    return require('./nx-reexports-pre16');
  }
}
