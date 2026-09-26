// Shared by this package's vitest suite AND other packages' jest suites, so
// it registers the mock through whichever runner is active. Each runner's
// transform only hoists its own literal call, so the branch not taken stays
// inert. Factories are inlined because hoisting would move the calls above
// any shared helper definition.
declare const vi: any;

if (typeof vi !== 'undefined') {
  // @ts-ignore
  vi.mock('fs', (): Partial<typeof import('fs')> => {
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
  vi.mock('node:fs', (): Partial<typeof import('fs')> => {
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
} else {
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
}
