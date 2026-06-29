import { normalizeOptions } from './normalize';
import { ExecutorContext } from '@nx/devkit';
import { readTsConfig } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/internal';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock<typeof import('@nx/js')>('@nx/js', () => {
  return {
    readTsConfig: jest.fn(() => ({
      fileNames: [],
      errors: [],
      options: {},
    })),
  };
});

// TODO Investigate how to ensure that the test is not being influenced by the current workspace setup
// Currently, we are using ts solution and it is generating the wrong results if not mocked this way.
jest.mock('@nx/js/internal', () => ({
  isUsingTsSolutionSetup: jest.fn(() => false),
}));

jest.mock('@nx/devkit/internal', () => ({
  loadConfigFile: jest.fn(),
}));

describe('normalizeOptions', () => {
  let tmpRoot: string | undefined;
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

  afterEach(() => {
    (loadConfigFile as jest.MockedFunction<typeof loadConfigFile>).mockReset();
    if (tmpRoot) {
      rmSync(tmpRoot, { recursive: true, force: true });
      tmpRoot = undefined;
    }
  });

  it('should handle single entry point options', async () => {
    expect(
      await normalizeOptions(
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
      excludeFromExternal: [],
      thirdParty: false,
      isTsSolutionSetup: false,
      declaration: undefined,
      declarationRootDir: undefined,
      skipTypeCheck: undefined,
      userDefinedBuildOptions: undefined,
    });
  });

  it('should handle multiple entry point options', async () => {
    expect(
      await normalizeOptions(
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
      excludeFromExternal: [],
      thirdParty: false,
      isTsSolutionSetup: false,
      declaration: undefined,
      declarationRootDir: undefined,
      skipTypeCheck: undefined,
      userDefinedBuildOptions: undefined,
    });
  });

  it('should support custom output file name', async () => {
    expect(
      await normalizeOptions(
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
      excludeFromExternal: [],
      thirdParty: false,
      isTsSolutionSetup: false,
      declaration: undefined,
      declarationRootDir: undefined,
      skipTypeCheck: undefined,
      userDefinedBuildOptions: undefined,
    });
  });

  it('should validate against multiple entry points + outputFileName', async () => {
    await expect(
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
    ).rejects.toThrow(/Cannot use/);
  });

  it('should add package.json to assets array if generatePackageJson is false', async () => {
    expect(
      await normalizeOptions(
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
      excludeFromExternal: [],
      thirdParty: false,
      isTsSolutionSetup: false,
      declaration: undefined,
      declarationRootDir: undefined,
      skipTypeCheck: undefined,
      userDefinedBuildOptions: undefined,
    });
  });

  it("should use the tsconfig declaration option if the declaration option isn't defined", async () => {
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
      await normalizeOptions(
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

  it('should override thirdParty if bundle:false', async () => {
    expect(
      await normalizeOptions(
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

  it('should override skipTypeCheck if declaration:true', async () => {
    expect(
      await normalizeOptions(
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

  it('should load ESM esbuild config files', async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'nx-esbuild-config-'));
    writeFileSync(
      join(tmpRoot, 'esbuild.config.mjs'),
      'export default { sourcemap: true, define: { __TEST__: "true" } };'
    );
    (
      loadConfigFile as jest.MockedFunction<typeof loadConfigFile>
    ).mockResolvedValue({
      sourcemap: true,
      define: { __TEST__: 'true' },
    });

    await expect(
      normalizeOptions(
        {
          main: 'apps/myapp/src/index.ts',
          outputPath: 'dist/apps/myapp',
          tsConfig: 'apps/myapp/tsconfig.app.json',
          assets: [],
          generatePackageJson: true,
          esbuildConfig: 'esbuild.config.mjs',
        },
        { ...context, root: tmpRoot, cwd: tmpRoot }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        userDefinedBuildOptions: {
          sourcemap: true,
          define: { __TEST__: 'true' },
        },
      })
    );
    expect(loadConfigFile).toHaveBeenCalledWith(
      join(tmpRoot, 'esbuild.config.mjs')
    );
  });
});
