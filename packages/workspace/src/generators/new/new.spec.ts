import { readJson, Tree, writeJson } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { createTree } from '@nx/devkit/testing';
import { Linter } from '../../utils/lint';
import {
  angularCliVersion,
  nxVersion,
  typescriptVersion,
} from '../../utils/versions';
import { Preset } from '../utils/presets';
import { newGenerator, NormalizedSchema } from './new';
import * as getNpmPackageVersion from './../utils/get-npm-package-version';
import * as generatePreset from './generate-preset';

const DEFAULT_PACKAGE_VERSION = '1.0.0';

const defaultOptions: Omit<
  NormalizedSchema,
  'name' | 'directory' | 'appName' | 'isCustomPreset'
> = {
  preset: Preset.Apps,
  skipInstall: false,
  linter: Linter.EsLint,
  defaultBase: 'main',
};

describe('new', () => {
  let tree: Tree;
  let installPackagesTaskSpy: jest.SpyInstance;
  let generatePresetSpy: jest.SpyInstance;
  let getNpmPackageVersionSpy: jest.SpyInstance;

  beforeEach(() => {
    tree = createTree();
    // we need an actual path for the package manager version check
    tree.root = process.cwd();

    installPackagesTaskSpy = jest
      .spyOn(devkit, 'installPackagesTask')
      .mockImplementation(() => undefined);

    generatePresetSpy = jest
      .spyOn(generatePreset, 'generatePreset')
      .mockImplementation(async () => undefined);

    getNpmPackageVersionSpy = jest
      .spyOn(getNpmPackageVersion, 'getNpmPackageVersion')
      .mockImplementation(
        (name, version) => version ?? DEFAULT_PACKAGE_VERSION
      );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should generate an empty nx.json', async () => {
    await (
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        appName: 'app',
      })
    )();
    expect(readJson(tree, 'my-workspace/nx.json')).toMatchSnapshot();
    expect(installPackagesTaskSpy).toHaveBeenCalled();
    expect(generatePresetSpy).toHaveBeenCalled();
  });

  it('should skip install', async () => {
    await (
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        appName: 'app',
        skipInstall: true,
      })
    )();
    expect(readJson(tree, 'my-workspace/nx.json')).toMatchSnapshot();
    expect(installPackagesTaskSpy).not.toHaveBeenCalled();
    expect(generatePresetSpy).toHaveBeenCalled();
  });

  describe('--preset', () => {
    it('should generate necessary npm dependencies for empty preset', async () => {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        appName: 'app',
        preset: Preset.Apps,
      });

      expect(readJson(tree, 'my-workspace/package.json')).toMatchSnapshot();
    });

    it('should generate necessary npm dependencies for react preset', async () => {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        appName: 'app',
        preset: Preset.ReactMonorepo,
        bundler: 'vite',
      });

      const { devDependencies } = readJson(tree, 'my-workspace/package.json');
      expect(devDependencies).toStrictEqual({
        '@nx/react': nxVersion,
        '@nx/vite': nxVersion,
        '@nx/workspace': nxVersion,
        nx: nxVersion,
      });
    });

    it('should generate necessary npm dependencies for vue preset', async () => {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        appName: 'app',
        e2eTestRunner: 'cypress',
        preset: Preset.VueMonorepo,
      });

      const { devDependencies } = readJson(tree, 'my-workspace/package.json');
      expect(devDependencies).toStrictEqual({
        '@nx/vue': nxVersion,
        '@nx/cypress': nxVersion,
        '@nx/vite': nxVersion,
        '@nx/workspace': nxVersion,
        nx: nxVersion,
      });
    });

    it('should generate necessary npm dependencies for nuxt preset', async () => {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        appName: 'app',
        e2eTestRunner: 'cypress',
        preset: Preset.Nuxt,
      });

      const { devDependencies } = readJson(tree, 'my-workspace/package.json');
      expect(devDependencies).toStrictEqual({
        '@nx/nuxt': nxVersion,
        '@nx/cypress': nxVersion,
        '@nx/workspace': nxVersion,
        nx: nxVersion,
      });
    });

    it('should generate necessary npm dependencies for angular preset', async () => {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        appName: 'app',
        preset: Preset.AngularMonorepo,
      });

      const { devDependencies, dependencies } = readJson(
        tree,
        'my-workspace/package.json'
      );
      expect(devDependencies).toStrictEqual({
        '@angular-devkit/core': angularCliVersion,
        '@nx/angular': nxVersion,
        '@nx/workspace': nxVersion,
        nx: nxVersion,
        typescript: typescriptVersion,
      });
    });

    describe('custom presets', () => {
      let originalValue;
      beforeEach(() => {
        originalValue = process.env['NX_E2E_PRESET_VERSION'];
      });

      afterEach(() => {
        if (originalValue) {
          process.env['NX_E2E_PRESET_VERSION'] = originalValue;
        } else {
          delete process.env['NX_E2E_PRESET_VERSION'];
        }
      });
      // the process of actual resolving of a version relies on npm and is mocked here,
      // thus "package@2" is expected to be resolved with version "2" instead of "2.0.0"
      const versionAsPath =
        '/Users/username/3rd-party-pkg/dist/packages/3rd-party-pkg-1.12.5.tgz';
      test.each`
        preset                       | presetVersion    | expectedVersion
        ${'3rd-party-package'}       | ${undefined}     | ${DEFAULT_PACKAGE_VERSION}
        ${'3rd-party-package@1.1.2'} | ${undefined}     | ${'1.1.2'}
        ${'3rd-party-package@2'}     | ${undefined}     | ${'2'}
        ${'3rd-party-package'}       | ${'latest'}      | ${'latest'}
        ${'3rd-party-package'}       | ${'1.1.1'}       | ${'1.1.1'}
        ${'3rd-party-package'}       | ${versionAsPath} | ${versionAsPath}
        ${'3rd-party-package@2.3.4'} | ${'1.1.1'}       | ${'1.1.1'}
      `(
        'should add custom preset "$preset" with a correct expectedVersion "$expectedVersion" when presetVersion is "$presetVersion"',
        async ({ presetVersion, preset, expectedVersion }) => {
          if (presetVersion) {
            process.env['NX_E2E_PRESET_VERSION'] = presetVersion;
          }

          await newGenerator(tree, {
            ...defaultOptions,
            name: 'my-workspace',
            directory: 'my-workspace',
            appName: 'app',
            preset,
          });

          const { devDependencies, dependencies } = readJson(
            tree,
            'my-workspace/package.json'
          );
          expect(dependencies).toStrictEqual({
            '3rd-party-package': expectedVersion,
          });
          expect(devDependencies).toStrictEqual({
            '@nx/workspace': nxVersion,
            nx: nxVersion,
          });
        }
      );
    });
  });

  it('should not modify any existing files', async () => {
    const packageJson = {
      dependencies: {
        existing: 'latest',
      },
    };
    const eslintConfig = {
      rules: {},
    };
    writeJson(tree, 'package.json', packageJson);
    writeJson(tree, '.eslintrc.json', eslintConfig);

    await newGenerator(tree, {
      ...defaultOptions,
      name: 'my-workspace',
      directory: 'my-workspace',
      appName: 'app',
    });

    expect(readJson(tree, 'package.json')).toEqual(packageJson);
    expect(readJson(tree, '.eslintrc.json')).toEqual(eslintConfig);
  });

  it('should throw an error when the directory is not empty', async () => {
    tree.write('my-workspace/file.txt', '');

    try {
      await newGenerator(tree, {
        ...defaultOptions,
        name: 'my-workspace',
        directory: 'my-workspace',
        appName: 'app',
      });
      fail('Generating into a non-empty directory should error.');
    } catch (e) {}
  });
});
