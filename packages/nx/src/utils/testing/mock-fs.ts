// @ts-ignore
jest.mock('fs', (): Partial<typeof import('fs')> => {
  const mockFs = require('memfs').fs;
  return {
    ...mockFs,
    existsSync(path: string) {
      if (path.endsWith('.node')) {
        return true;
      } else {
        return mockFs.existsSync(path);
      }
    },
  };
});

// @ts-ignore
jest.mock('node:fs', (): Partial<typeof import('fs')> => {
  const mockFs = require('memfs').fs;
  return {
    ...mockFs,
    existsSync(path: string) {
      if (path.endsWith('.node')) {
        return true;
      } else {
        return mockFs.existsSync(path);
      }
    },
  };
});
