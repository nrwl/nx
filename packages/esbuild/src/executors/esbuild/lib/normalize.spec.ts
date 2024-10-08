import { normalizeOptions } from './normalize';
import { ExecutorContext } from '@nx/devkit';
import { readTsConfig } from '@nx/js';

jest.mock<typeof import('@nx/js')>('@nx/js', () => {
  const actualModule = jest.requireActual('@nx/js');

  return {
    ...actualModule,
    readTsConfig: jest.fn(() => ({
      fileNames: [],
      errors: [],
      options: {},
    })),
  };
});

describe('normalizeOptions', () => {
  const context: ExecutorContext = {
    root: '/',
    cwd: '/',
    isVerbose: false,
    projectName: 'myapp',
    nxJsonConfiguration: {},
    projectsConfigurations: {
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
        },
      },
    },
    projectGraph: {
      nodes: {
        myapp: {
          type: 'app',
          name: 'myapp',
          data: {
            root: 'apps/myapp',
          },
        },
      },
      dependencies: {},
    },
  };

  it('should handle single entry point options', () => {
    expect(
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          generatePackageJson: true,
          assets: [],
        },
        context
      )
    ).toEqual({
      main: 'apps/myapp/src/index.ts',
      outputPath: 'dist/apps/myapp',
      tsConfig: 'apps/myapp/tsconfig.app.json',
      assets: [],
      generatePackageJson: true,
      outputFileName: 'index.js',
      singleEntry: true,
      external: [],
      thirdParty: false,
    });
  });

  it('should handle multiple entry point options', () => {
    expect(
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          generatePackageJson: true,
          additionalEntryPoints: ['apps/myapp/src/extra-entry.ts'],
        },
        context
      )
    ).toEqual({
      main: 'apps/myapp/src/index.ts',
      outputPath: 'dist/apps/myapp',
      tsConfig: 'apps/myapp/tsconfig.app.json',
      assets: [],
      generatePackageJson: true,
      outputFileName: 'index.js',
      additionalEntryPoints: ['apps/myapp/src/extra-entry.ts'],
      singleEntry: false,
      external: [],
      thirdParty: false,
    });
  });

  it('should support custom output file name', () => {
    expect(
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          generatePackageJson: true,
          outputFileName: 'test.js',
        },
        context
      )
    ).toEqual({
      main: 'apps/myapp/src/index.ts',
      outputPath: 'dist/apps/myapp',
      tsConfig: 'apps/myapp/tsconfig.app.json',
      assets: [],
      generatePackageJson: true,
      outputFileName: 'test.js',
      singleEntry: true,
      external: [],
      thirdParty: false,
    });
  });

  it('should validate against multiple entry points + outputFileName', () => {
    expect(() =>
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          generatePackageJson: true,
          additionalEntryPoints: ['apps/myapp/src/extra-entry.ts'],
          outputFileName: 'test.js',
          thirdParty: false,
        },
        context
      )
    ).toThrow(/Cannot use/);
  });

  it('should add package.json to assets array if generatePackageJson is false', () => {
    expect(
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          generatePackageJson: false,
          assets: [],
        },
        context
      )
    ).toEqual({
      main: 'apps/myapp/src/index.ts',
      outputPath: 'dist/apps/myapp',
      tsConfig: 'apps/myapp/tsconfig.app.json',
      assets: ['apps/myapp/package.json'],
      generatePackageJson: false,
      outputFileName: 'index.js',
      singleEntry: true,
      external: [],
      thirdParty: false,
    });
  });

  it("should use the tsconfig declaration option if the declaration option isn't defined", () => {
    (
      readTsConfig as jest.MockedFunction<typeof readTsConfig>
    ).mockImplementationOnce(() => ({
      fileNames: [],
      errors: [],
      options: {
        declaration: true,
      },
    }));

    expect(
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          generatePackageJson: true,
          assets: [],
        },
        context
      )
    ).toEqual(expect.objectContaining({ declaration: true }));
  });

  it('should override thirdParty if bundle:false', () => {
    expect(
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          generatePackageJson: true,
          bundle: false,
          thirdParty: true,
          assets: [],
        },
        context
      )
    ).toEqual(expect.objectContaining({ thirdParty: false }));
  });

  it('should override skipTypeCheck if declaration:true', () => {
    expect(
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          generatePackageJson: true,
          skipTypeCheck: true,
          declaration: true,
          assets: [],
        },
        context
      )
    ).toEqual(expect.objectContaining({ skipTypeCheck: false }));
  });
});
