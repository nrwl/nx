/**
 * Side-effect module: registers a jest mock of `fs`/`node:fs` backed by memfs
 * for specs that exercise the filesystem. It must remain a dedicated subpath
 * (not part of the internal-testing-utils barrel) because importing it applies
 * the mock — a barrel import would do so for every consumer.
 */
type FsMock = Partial<typeof import('fs')>;

declare const jest: {
  mock(moduleName: 'fs' | 'node:fs', factory: () => FsMock): void;
};

function createMockFs(): FsMock {
  const mockFs = require('memfs').fs as typeof import('fs');
  return {
    ...mockFs,
    existsSync(path: Parameters<typeof import('fs').existsSync>[0]) {
      if (path.toString().endsWith('.node')) {
        return true;
      } else {
        return mockFs.existsSync(path);
      }
    },
  };
}

jest.mock('fs', createMockFs);
jest.mock('node:fs', createMockFs);

export {};
