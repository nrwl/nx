// @ts-ignore
jest.mock('fs', (): Partial<typeof import('fs')> => {
  const mockFs = require('memfs').fs;
  return {
    ...mockFs,
    realpath: {
      ...mockFs.realpath,
      native: () => {
        // @SEE: https://github.com/streamich/memfs/issues/735
        // realpath.native is not implemeted in memfs
        // @SEE: https://github.com/streamich/memfs/issues/803
        // fs-extra is "defensively patched" to emit a warning if the function does not exist
        // So if we are mocking fs with memfs "fs.realpath.native" will not work properly in tests, so throwing an error
        // will prevent harder to debug issues with writing tests that use memfs
        throw Error('[mock-fs.ts] Not implemented');
      },
    },
    existsSync(path: string) {
      if (path.endsWith('.node')) {
        return true;
      } else {
        return mockFs.existsSync(path);
      }
    },
  };
});
