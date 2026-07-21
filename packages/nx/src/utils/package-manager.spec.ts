jest.mock('fs', () => {
  return {
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});
jest.mock('child_process');

import * as fs from 'fs';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as childProcess from 'child_process';
import { tmpdir } from 'os';
import { parse } from 'yaml';

import * as configModule from '../config/configuration';
import * as projectGraphFileUtils from '../project-graph/file-utils';
import * as fileUtils from '../utils/fileutils';
import * as registryConfig from './registry-config';
import { workspaceRoot } from './workspace-root';
import {
  addPackagePathToWorkspaces,
  detectPackageManager,
  getPackageManagerCommand,
  getPackageManagerVersion,
  getPackageWorkspaces,
  isWorkspacesEnabled,
  modifyPnpmWorkspaceYamlToFitNewDirectory,
  modifyYarnRcToFitNewDirectory,
  modifyYarnRcYmlToFitNewDirectory,
  packageRegistryPack,
  packageRegistryView,
  parseVersionFromPackageManagerField,
  PackageManager,
} from './package-manager';

describe('package-manager', () => {
  describe('detectPackageManager', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    });
    it('should detect package manager in nxJson', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
        cli: {
          packageManager: 'pnpm',
        },
      });
      expect(detectPackageManager()).toEqual('pnpm');

      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
        cli: {
          packageManager: 'yarn',
        },
      });
      expect(detectPackageManager()).toEqual('yarn');
    });

    it('should detect yarn package manager from yarn.lock', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return true;
          case 'pnpm-lock.yaml':
            return false;
          case 'package-lock.json':
            return false;
          case 'bun.lockb':
            return false;
          case 'bun.lock':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('yarn');
      expect(fs.existsSync).toHaveBeenNthCalledWith(3, 'yarn.lock');
    });

    it('should detect pnpm package manager from pnpm-lock.yaml', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return false;
          case 'pnpm-lock.yaml':
            return true;
          case 'package-lock.json':
            return false;
          case 'bun.lockb':
            return false;
          case 'bun.lock':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('pnpm');
      expect(fs.existsSync).toHaveBeenCalledTimes(4);
    });

    it('should detect bun package manager from bun.lockb', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return false;
          case 'pnpm-lock.yaml':
            return false;
          case 'package-lock.json':
            return false;
          case 'bun.lockb':
            return true;
          case 'bun.lock':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('bun');
      expect(fs.existsSync).toHaveBeenCalledTimes(1);
    });

    it('should detect bun package manager from bun.lock', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return false;
          case 'pnpm-lock.yaml':
            return false;
          case 'package-lock.json':
            return false;
          case 'bun.lock':
            return true;
          case 'bun.lockb':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('bun');
      expect(fs.existsSync).toHaveBeenCalledTimes(2);
    });

    it('should use npm package manager as default', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return false;
          case 'pnpm-lock.yaml':
            return false;
          case 'package-lock.json':
            return false;
          case 'bun.lockb':
            return false;
          case 'bun.lock':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const originalUserAgent = process.env.npm_config_user_agent;
      delete process.env.npm_config_user_agent;
      try {
        const packageManager = detectPackageManager();
        expect(packageManager).toEqual('npm');
        expect(fs.existsSync).toHaveBeenCalledTimes(5);
      } finally {
        process.env.npm_config_user_agent = originalUserAgent;
      }
    });

    it('should detect npm package manager from package-lock.json', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return false;
          case 'pnpm-lock.yaml':
            return false;
          case 'package-lock.json':
            return true;
          case 'bun.lockb':
            return false;
          case 'bun.lock':
            return false;
          default:
            return jest.requireActual('fs').existsSync(p);
        }
      });
      const packageManager = detectPackageManager();
      expect(packageManager).toEqual('npm');
      expect(fs.existsSync).toHaveBeenCalledTimes(5);
    });

    it('should detect pnpm from npm_config_user_agent when no lock file exists', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const originalUserAgent = process.env.npm_config_user_agent;
      process.env.npm_config_user_agent =
        'pnpm/8.15.4 npm/? node/v20.11.1 darwin arm64';
      try {
        expect(detectPackageManager()).toEqual('pnpm');
      } finally {
        process.env.npm_config_user_agent = originalUserAgent;
      }
    });

    it('should detect yarn from npm_config_user_agent when no lock file exists', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const originalUserAgent = process.env.npm_config_user_agent;
      process.env.npm_config_user_agent =
        'yarn/1.22.21 npm/? node/v20.11.1 darwin arm64';
      try {
        expect(detectPackageManager()).toEqual('yarn');
      } finally {
        process.env.npm_config_user_agent = originalUserAgent;
      }
    });

    it('should detect bun from npm_config_user_agent when no lock file exists', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const originalUserAgent = process.env.npm_config_user_agent;
      process.env.npm_config_user_agent = 'bun/1.0.25';
      try {
        expect(detectPackageManager()).toEqual('bun');
      } finally {
        process.env.npm_config_user_agent = originalUserAgent;
      }
    });

    it('should prefer lock file detection over npm_config_user_agent', () => {
      jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({});
      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn.lock':
            return true;
          default:
            return false;
        }
      });
      const originalUserAgent = process.env.npm_config_user_agent;
      process.env.npm_config_user_agent =
        'pnpm/8.15.4 npm/? node/v20.11.1 darwin arm64';
      try {
        expect(detectPackageManager()).toEqual('yarn');
      } finally {
        process.env.npm_config_user_agent = originalUserAgent;
      }
    });
  });

  describe('getPackageManagerVersion', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    });

    it('should detect package manager from --version', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(childProcess, 'execSync').mockImplementation((p) => {
        switch (p) {
          case 'yarn --version':
            return '1.22.10';
          case 'pnpm --version':
            return '5.17.5';
          case 'npm --version':
            return '7.20.3';
          default:
            return jest.requireActual('child_process').execSync(p);
        }
      });
      expect(getPackageManagerVersion('yarn')).toEqual('1.22.10');
      expect(getPackageManagerVersion('pnpm')).toEqual('5.17.5');
      expect(getPackageManagerVersion('npm')).toEqual('7.20.3');
    });

    it('should detect pnpm package manager version from package.json packageManager', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest
        .spyOn(fileUtils, 'readJsonFile')
        .mockReturnValueOnce({ packageManager: 'pnpm@6.32.4' });
      expect(getPackageManagerVersion('pnpm')).toEqual('6.32.4');
    });

    it('should detect yarn package manager from package.json packageManager', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest
        .spyOn(fileUtils, 'readJsonFile')
        .mockReturnValueOnce({ packageManager: 'yarn@6.32.4' });
      expect(getPackageManagerVersion('yarn')).toEqual('6.32.4');
    });

    it('should detect npm package manager from package.json packageManager', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest
        .spyOn(fileUtils, 'readJsonFile')
        .mockReturnValueOnce({ packageManager: 'npm@6.32.4' });
      expect(getPackageManagerVersion('npm')).toEqual('6.32.4');
    });

    it('should throw an error if packageManager does not exist in package.json', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest.spyOn(fileUtils, 'readJsonFile').mockReturnValueOnce({});
      expect(() => getPackageManagerVersion('npm')).toThrow();
    });

    it('should throw an error if packageManager in package.json does not match detected pacakge manager', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Command failed');
      });
      jest
        .spyOn(fileUtils, 'readJsonFile')
        .mockReturnValueOnce({ packageManager: 'npm@6.32.4' });
      expect(() => getPackageManagerVersion('yarn')).toThrow();
    });
  });

  describe('isWorkspacesEnabled', () => {
    it('should return true if package manager is pnpm and pnpm-workspace.yaml exists', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      jest
        .spyOn(fs, 'readFileSync')
        .mockReturnValueOnce('packages:\n  - apps/*');
      expect(isWorkspacesEnabled('pnpm')).toEqual(true);
    });

    it('should return false if package manager is pnpm and pnpm-workspace.yaml does not exist', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
      expect(isWorkspacesEnabled('pnpm')).toEqual(false);
    });

    it('should return true if package manager is yarn and workspaces exists in package.json', () => {
      jest
        .spyOn(projectGraphFileUtils, 'readPackageJson')
        .mockReturnValueOnce({ workspaces: ['packages/*'] });
      expect(isWorkspacesEnabled('yarn')).toEqual(true);
    });

    it('should return false if package manager is yarn and workspaces does not exist in package.json', () => {
      jest
        .spyOn(projectGraphFileUtils, 'readPackageJson')
        .mockReturnValueOnce({});
      expect(isWorkspacesEnabled('yarn')).toEqual(false);
    });

    it('should return true if package manager is npm and workspaces exists in package.json', () => {
      jest
        .spyOn(projectGraphFileUtils, 'readPackageJson')
        .mockReturnValueOnce({ workspaces: ['packages/*'] });
      expect(isWorkspacesEnabled('npm')).toEqual(true);
    });

    it('should return false if package manager is npm and workspaces does not exist in package.json', () => {
      jest
        .spyOn(projectGraphFileUtils, 'readPackageJson')
        .mockReturnValueOnce({});
      expect(isWorkspacesEnabled('npm')).toEqual(false);
    });
  });

  describe('modifyYarnRcYmlToFitNewDirectory', () => {
    it('should update paths properly', () => {
      expect(
        modifyYarnRcYmlToFitNewDirectory('yarnPath: ./bin/yarn.js')
      ).toEqual('');
    });

    it('should update plugins appropriately', () => {
      expect(
        modifyYarnRcYmlToFitNewDirectory(
          [
            'enableProgressBars: false',
            'plugins:',
            '  - ./scripts/yarn-plugin.js',
            '  - path: .yarn/plugins/imported-plugin.js',
            '    spec: imported-plugin',
          ].join('\n')
        )
      ).toEqual('enableProgressBars: false\n');
    });
  });

  describe('modifyYarnRcToFitNewDirectory', () => {
    it('should update paths properly', () => {
      expect(modifyYarnRcToFitNewDirectory('yarn-path ./bin/yarn.js')).toEqual(
        ''
      );
    });

    it('should not update other options', () => {
      expect(
        modifyYarnRcToFitNewDirectory(
          ['yarn-path ./bin/yarn.js', 'enableProgressBars false'].join('\n')
        )
      ).toEqual('enableProgressBars false');
    });
  });

  describe('modifyPnpmWorkspaceYamlToFitNewDirectory', () => {
    it('should replace member globs with a temp-root self-reference but keep settings', () => {
      const result = modifyPnpmWorkspaceYamlToFitNewDirectory(
        [
          'packages:',
          "  - 'packages/*'",
          "  - '!libs/owners'",
          'minimumReleaseAge: 1440',
          'registry: https://example.com/',
        ].join('\n')
      );
      // The original member globs don't resolve in the temp dir, so drop them...
      expect(result).not.toContain('packages/*');
      expect(result).not.toContain('!libs/owners');
      // ...but keep `packages` non-empty so pnpm <10.5 accepts the manifest.
      expect(parse(result).packages).toEqual(['.']);
      expect(result).toContain('minimumReleaseAge: 1440');
      expect(result).toContain('registry: https://example.com/');
    });

    it('should add a packages field when the source manifest has none', () => {
      // pnpm <10.5 (and corepack's default pnpm) reject a workspace manifest
      // whose `packages` field is missing or empty.
      const result = modifyPnpmWorkspaceYamlToFitNewDirectory(
        ['minimumReleaseAge: 1440', 'registry: https://example.com/'].join('\n')
      );
      expect(parse(result).packages).toEqual(['.']);
      expect(result).toContain('minimumReleaseAge: 1440');
      expect(result).toContain('registry: https://example.com/');
    });

    it('should drop patchedDependencies pointing at relative paths', () => {
      const result = modifyPnpmWorkspaceYamlToFitNewDirectory(
        [
          'patchedDependencies:',
          '  foo@1.0.0: patches/foo@1.0.0.patch',
          'minimumReleaseAge: 1440',
        ].join('\n')
      );
      expect(result).not.toContain('patchedDependencies');
      expect(result).not.toContain('patches/foo');
      expect(result).toContain('minimumReleaseAge: 1440');
    });

    it('should drop link:/file: overrides but keep version overrides', () => {
      // `pnpm link` writes a relative link: override; in the temp dir it points
      // at a non-existent path and hijacks exact-version adds.
      const result = modifyPnpmWorkspaceYamlToFitNewDirectory(
        [
          'overrides:',
          '  nx: link:packages/nx',
          '  foo: file:../foo',
          "  minimist: '^1.2.6'",
          'minimumReleaseAge: 1440',
        ].join('\n')
      );
      expect(result).not.toContain('link:packages/nx');
      expect(result).not.toContain('file:../foo');
      expect(parse(result).overrides).toEqual({ minimist: '^1.2.6' });
      expect(result).toContain('minimumReleaseAge: 1440');
    });

    it('should drop the overrides map entirely when only link: entries exist', () => {
      const result = modifyPnpmWorkspaceYamlToFitNewDirectory(
        ['overrides:', '  nx: link:packages/nx'].join('\n')
      );
      expect(parse(result).overrides).toBeUndefined();
    });

    it('should add a packages field to an empty or comments-only manifest', () => {
      // An empty/comments-only source has null doc contents; older pnpm still
      // rejects a packages-less manifest, so `packages: ['.']` must be added.
      for (const src of ['', '   \n', '# only a comment\n']) {
        expect(
          parse(modifyPnpmWorkspaceYamlToFitNewDirectory(src)).packages
        ).toEqual(['.']);
      }
    });
  });

  describe('getPackageWorkspaces', () => {
    const tempWorkspace = join(tmpdir(), 'addPackagePathToWorkspaces');

    beforeAll(() => {
      if (!existsSync(tempWorkspace)) {
        mkdirSync(tempWorkspace, { recursive: true });
      }
    });
    describe.each(['npm', 'yarn', 'bun'])('%s workspaces', (packageManager) => {
      it('should return workspaces from package.json', () => {
        writeFileSync(
          join(tempWorkspace, 'package.json'),
          '{"workspaces": ["packages/*"]}'
        );
        jest
          .spyOn(fs, 'readFileSync')
          .mockImplementation((...args) =>
            jest.requireActual('fs').readFileSync(...args)
          );
        const workspaces = getPackageWorkspaces(
          packageManager as PackageManager,
          tempWorkspace
        );
        expect(workspaces).toEqual(['packages/*']);
      });

      it('should return empty array if workspaces does not exist', () => {
        writeFileSync(join(tempWorkspace, 'package.json'), '{}');
        const workspaces = getPackageWorkspaces(
          packageManager as PackageManager,
          tempWorkspace
        );
        expect(workspaces).toEqual([]);
      });
    });

    describe('pnpm workspaces', () => {
      beforeEach(() => {
        if (existsSync(join(tempWorkspace, 'pnpm-workspace.yaml'))) {
          rmSync(join(tempWorkspace, 'pnpm-workspace.yaml'));
        }
      });

      it('should return workspaces from package.json', () => {
        writeFileSync(
          join(tempWorkspace, 'pnpm-workspace.yaml'),
          `packages:\n  - apps/*`
        );

        jest
          .spyOn(fs, 'readFileSync')
          .mockImplementation((...args) =>
            jest.requireActual('fs').readFileSync(...args)
          );
        jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
        const workspaces = getPackageWorkspaces('pnpm', tempWorkspace);
        expect(workspaces).toEqual(['apps/*']);
      });

      it('should return empty array if workspaces is empty', () => {
        writeFileSync(join(tempWorkspace, 'pnpm-workspace.yaml'), '');
        const workspaces = getPackageWorkspaces('pnpm', tempWorkspace);
        expect(workspaces).toEqual([]);
      });
    });
  });

  describe('addPackagePathToWorkspaces', () => {
    const tempWorkspace = join(tmpdir(), 'addPackagePathToWorkspaces');

    beforeAll(() => {
      if (!existsSync(tempWorkspace)) {
        mkdirSync(tempWorkspace, { recursive: true });
      }
    });

    describe.each(['npm', 'yarn', 'bun'])('%s workspaces', (packageManager) => {
      it('should add to workspaces if it is empty', () => {
        writeFileSync(join(tempWorkspace, 'package.json'), '{}');
        addPackagePathToWorkspaces(
          'packages/app',
          packageManager as PackageManager,
          [],
          tempWorkspace
        );
        expect(readFileSync(join(tempWorkspace, 'package.json'), 'utf-8'))
          .toMatchInlineSnapshot(`
          "{
            "workspaces": [
              "packages/app"
            ]
          }"
        `);
      });

      it('should add to workspaces if it is defined', () => {
        writeFileSync(
          join(tempWorkspace, 'package.json'),
          '{"workspaces": ["test"]}'
        );
        addPackagePathToWorkspaces(
          'packages/app',
          packageManager as PackageManager,
          ['test'],
          tempWorkspace
        );
        expect(readFileSync(join(tempWorkspace, 'package.json'), 'utf-8'))
          .toMatchInlineSnapshot(`
            "{
              "workspaces": [
                "test",
                "packages/app"
              ]
            }"
          `);
      });

      it('should not add if package path is already in existing workspaces', () => {
        writeFileSync(
          join(tempWorkspace, 'package.json'),
          '{"workspaces": ["packages/*"]}'
        );
        addPackagePathToWorkspaces(
          'packages/app',
          packageManager as PackageManager,
          ['packages/*'],
          tempWorkspace
        );
      });
    });

    describe('pnpm workspaces', () => {
      beforeEach(() => {
        if (existsSync(join(tempWorkspace, 'pnpm-workspace.yaml'))) {
          rmSync(join(tempWorkspace, 'pnpm-workspace.yaml'));
        }
      });

      it('should create pnpm-workspace.yaml if it does not exist', () => {
        addPackagePathToWorkspaces('packages/app', 'pnpm', [], tempWorkspace);
        expect(
          readFileSync(join(tempWorkspace, 'pnpm-workspace.yaml'), 'utf-8')
        ).toMatchInlineSnapshot(`
          "packages:
            - packages/app
          "
        `);
      });

      it('should add to packages if pnpm-workspace.yaml is empty', () => {
        writeFileSync(join(tempWorkspace, 'pnpm-workspace.yaml'), '');
        addPackagePathToWorkspaces('packages/app', 'pnpm', [], tempWorkspace);
        expect(
          readFileSync(join(tempWorkspace, 'pnpm-workspace.yaml'), 'utf-8')
        ).toMatchInlineSnapshot(`
          "packages:
            - packages/app
          "
        `);
      });

      it('should add to packages if packages is empty', () => {
        writeFileSync(join(tempWorkspace, 'pnpm-workspace.yaml'), 'packages:');
        addPackagePathToWorkspaces('packages/app', 'pnpm', [], tempWorkspace);
        expect(
          readFileSync(join(tempWorkspace, 'pnpm-workspace.yaml'), 'utf-8')
        ).toMatchInlineSnapshot(`
          "packages:
            - packages/app
          "
        `);
      });

      it('should add to pnpm workspace if there are packages defined', () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        writeFileSync(
          join(tempWorkspace, 'pnpm-workspace.yaml'),
          `packages:\n  - apps/*`
        );
        addPackagePathToWorkspaces('packages/app', 'pnpm', [], tempWorkspace);
        expect(readFileSync(`${tempWorkspace}/pnpm-workspace.yaml`, 'utf-8'))
          .toMatchInlineSnapshot(`
          "packages:
            - apps/*
            - packages/app
          "
        `);
      });

      it('should not add to pnpm workspace if package path is already in', () => {
        writeFileSync(
          join(tempWorkspace, 'pnpm-workspace.yaml'),
          `packages:\n  - apps/*`
        );
        addPackagePathToWorkspaces('apps/app1', 'pnpm', [], tempWorkspace);
      });

      it('should preserve comments', () => {
        jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
        writeFileSync(
          join(tempWorkspace, 'pnpm-workspace.yaml'),
          `packages:\n  - apps/* # comment`
        );
        addPackagePathToWorkspaces('packages/app', 'pnpm', [], tempWorkspace);
        expect(readFileSync(`${tempWorkspace}/pnpm-workspace.yaml`, 'utf-8'))
          .toMatchInlineSnapshot(`
          "packages:
            - apps/* # comment
            - packages/app
          "
        `);
      });

      it('should add packages key if it is not defined', () => {
        jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
        writeFileSync(
          join(tempWorkspace, 'pnpm-workspace.yaml'),
          `something:\n  - random/* # comment`
        );
        addPackagePathToWorkspaces('packages/app', 'pnpm', [], tempWorkspace);
        expect(readFileSync(`${tempWorkspace}/pnpm-workspace.yaml`, 'utf-8'))
          .toMatchInlineSnapshot(`
          "something:
            - random/* # comment
          packages:
            - packages/app
          "
        `);
      });
    });
  });

  describe('parseVersionFromPackageManagerField', () => {
    it('should return null for invalid semver', () => {
      expect(parseVersionFromPackageManagerField('yarn', 'bad')).toEqual(null);
      expect(parseVersionFromPackageManagerField('yarn', '2.1')).toEqual(null);
      expect(
        parseVersionFromPackageManagerField(
          'yarn',
          'https://registry.npmjs.org/@yarnpkg/cli-dist/-/cli-dist-3.2.3.tgz#sha224.16a0797d1710d1fb7ec40ab5c3801b68370a612a9b66ba117ad9924b'
        )
      ).toEqual(null);
    });

    it('should <major>.<minor>.<patch> version', () => {
      expect(parseVersionFromPackageManagerField('yarn', 'yarn@3.2.3')).toEqual(
        '3.2.3'
      );
      expect(
        parseVersionFromPackageManagerField(
          'yarn',
          'yarn@3.2.3+sha224.953c8233f7a92884eee2de69a1b92d1f2ec1655e66d08071ba9a02fa'
        )
      ).toEqual('3.2.3');
    });
  });

  describe('getPackageManagerCommand', () => {
    const publishCmdParam: [string, string, string, string] = [
      'dist/packages/my-pkg',
      'https://registry.npmjs.org/',
      '@org:registry',
      'latest',
    ];
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return npm publish command', () => {
      const commands = getPackageManagerCommand('npm');
      expect(commands.publish(...publishCmdParam)).toEqual(
        'npm publish "dist/packages/my-pkg" --json --"@org:registry=https://registry.npmjs.org/" --tag=latest'
      );
    });

    it('should return yarn publish command using npm publish', () => {
      const commands = getPackageManagerCommand('yarn');
      expect(commands.publish(...publishCmdParam)).toEqual(
        'npm publish "dist/packages/my-pkg" --json --"@org:registry=https://registry.npmjs.org/" --tag=latest'
      );
    });

    it('should return pnpm publish command with scoped registry when provided for pnpm version >= 9.15.7 < 10.0.0 || >= 10.5.0', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation((p) => {
        switch (p) {
          case 'pnpm --version':
            return '9.15.7';
        }
      });
      const commands = getPackageManagerCommand('pnpm');
      expect(commands.publish(...publishCmdParam)).toEqual(
        'pnpm publish "dist/packages/my-pkg" --json --"@org:registry=https://registry.npmjs.org/" --tag=latest --no-git-checks'
      );
    });

    it('should return pnpm publish command without use scoped registry for pnpm version < 9.15.7', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation((p) => {
        switch (p) {
          case 'pnpm --version':
            return '9.10.1';
          default:
            throw new Error('Command failed');
        }
      });
      jest.spyOn(fileUtils, 'readJsonFile').mockReturnValueOnce({});
      const commands = getPackageManagerCommand('pnpm');
      expect(commands.publish(...publishCmdParam)).toEqual(
        'pnpm publish "dist/packages/my-pkg" --json --"registry=https://registry.npmjs.org/" --tag=latest --no-git-checks'
      );
    });

    it('should return bun publish command with registry and tag', () => {
      const commands = getPackageManagerCommand('bun');
      expect(commands.publish(...publishCmdParam)).toEqual(
        'bun publish --cwd="dist/packages/my-pkg" --json --registry="https://registry.npmjs.org/" --tag=latest'
      );
    });

    it('should return pnpm add commands with --config.frozen-lockfile=false in a workspace', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation((p) => {
        if (p === 'pnpm --version') {
          return '9.15.7';
        }
        throw new Error(`Unexpected command: ${p}`);
      });
      (existsSync as jest.Mock).mockImplementation((path: string) =>
        path.endsWith('pnpm-workspace.yaml')
      );
      const commands = getPackageManagerCommand('pnpm');
      expect(commands.add).toEqual(
        'pnpm add -w --config.frozen-lockfile=false'
      );
      expect(commands.addDev).toEqual(
        'pnpm add -Dw --config.frozen-lockfile=false'
      );
    });

    it('should return pnpm add commands with --config.frozen-lockfile=false outside a workspace', () => {
      jest.spyOn(childProcess, 'execSync').mockImplementation((p) => {
        if (p === 'pnpm --version') {
          return '9.15.7';
        }
        throw new Error(`Unexpected command: ${p}`);
      });
      (existsSync as jest.Mock).mockReturnValue(false);
      const commands = getPackageManagerCommand('pnpm');
      expect(commands.add).toEqual('pnpm add --config.frozen-lockfile=false');
      expect(commands.addDev).toEqual(
        'pnpm add -D --config.frozen-lockfile=false'
      );
    });
  });

  describe('packageRegistryView', () => {
    let execMock: jest.SpyInstance;

    beforeEach(() => {
      execMock = jest.spyOn(childProcess, 'exec').mockImplementation(((
        _cmd: string,
        options: any,
        callback: any
      ) => {
        const cb = typeof options === 'function' ? options : callback;
        cb(null, { stdout: '' });
        return undefined;
      }) as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    });

    it('should force npm to bypass devEngines enforcement when substituting npm in a yarn workspace', async () => {
      jest
        .spyOn(configModule, 'readNxJson')
        .mockReturnValue({ cli: { packageManager: 'yarn' } });

      await packageRegistryView('nx', 'latest', '--json');

      const [cmd, options] = execMock.mock.calls[0];
      expect(cmd).toContain('npm view');
      expect(options.env.npm_config_force).toBe('true');
    });

    it('should not force when querying through pnpm', async () => {
      jest
        .spyOn(configModule, 'readNxJson')
        .mockReturnValue({ cli: { packageManager: 'pnpm' } });

      await packageRegistryView('nx', 'latest', '--json');

      const [cmd, options] = execMock.mock.calls[0];
      expect(cmd).toContain('pnpm view');
      expect(options.env?.npm_config_force).toBeUndefined();
    });

    it('should run from the workspace root and apply the registry overlay to the spawn env', async () => {
      jest
        .spyOn(configModule, 'readNxJson')
        .mockReturnValue({ cli: { packageManager: 'bun' } });
      jest.spyOn(childProcess, 'execSync').mockReturnValue('1.2.0' as any);
      (existsSync as jest.Mock).mockImplementation(
        (p: string) => p === join(workspaceRoot, 'package.json')
      );
      const overlaySpy = jest
        .spyOn(registryConfig, 'getNpmSpawnRegistryEnv')
        .mockReturnValue({
          npm_config_registry: 'https://sentinel.example.com/',
        });

      await packageRegistryView('nx', 'latest', '--json');

      const [, options] = execMock.mock.calls[0];
      expect(options.cwd).toBe(workspaceRoot);
      expect(options.env.npm_config_registry).toBe(
        'https://sentinel.example.com/'
      );
      expect(overlaySpy).toHaveBeenNthCalledWith(
        1,
        'nx',
        workspaceRoot,
        'bun',
        '1.2.0'
      );
    });

    it('should drop an ambient npm config key that spells an overlaid setting differently', async () => {
      // npm reads its env tier last-write-wins over the key order it receives,
      // and the shells in the spawn path reorder it, so both spellings surviving
      // means the ambient one can win.
      jest
        .spyOn(configModule, 'readNxJson')
        .mockReturnValue({ cli: { packageManager: 'bun' } });
      jest.spyOn(childProcess, 'execSync').mockReturnValue('1.2.0' as any);
      jest.spyOn(registryConfig, 'getNpmSpawnRegistryEnv').mockReturnValue({
        npm_config_registry: 'https://sentinel.example.com/',
      });
      const saved = process.env.NPM_CONFIG_REGISTRY;
      process.env.NPM_CONFIG_REGISTRY = 'https://ambient.example.com/';

      try {
        await packageRegistryView('nx', 'latest', '--json');
      } finally {
        if (saved === undefined) {
          delete process.env.NPM_CONFIG_REGISTRY;
        } else {
          process.env.NPM_CONFIG_REGISTRY = saved;
        }
      }

      const [, options] = execMock.mock.calls[0];
      expect(options.env.NPM_CONFIG_REGISTRY).toBeUndefined();
      expect(options.env.npm_config_registry).toBe(
        'https://sentinel.example.com/'
      );
    });

    it('should resolve config from the Nx installation directory in a non-JS workspace', async () => {
      // A non-JS workspace has no root package.json; its .npmrc and package
      // manager files live under .nx/installation.
      (existsSync as jest.Mock).mockReturnValue(false);
      const overlaySpy = jest
        .spyOn(registryConfig, 'getNpmSpawnRegistryEnv')
        .mockReturnValue({});

      await packageRegistryView('nx', 'latest', '--json');

      const installationPath = join(workspaceRoot, '.nx', 'installation');
      const [, options] = execMock.mock.calls[0];
      expect(options.cwd).toBe(installationPath);
      expect(overlaySpy.mock.calls[0][1]).toBe(installationPath);
    });
  });

  describe('packageRegistryPack', () => {
    let execMock: jest.SpyInstance;

    beforeEach(() => {
      execMock = jest.spyOn(childProcess, 'exec').mockImplementation(((
        _cmd: string,
        options: any,
        callback: any
      ) => {
        const cb = typeof options === 'function' ? options : callback;
        cb(null, { stdout: 'nx-1.0.0.tgz' });
        return undefined;
      }) as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    });

    it('should force npm to bypass devEngines enforcement', async () => {
      await packageRegistryPack('/tmp/pack', 'nx', '1.0.0');

      const [cmd, options] = execMock.mock.calls[0];
      // Spec is quoted so range operators are not parsed as shell redirections.
      expect(cmd).toContain('npm pack "nx@1.0.0"');
      expect(options.env.npm_config_force).toBe('true');
    });

    it('should leave npm min-release-age alone by default', async () => {
      await packageRegistryPack('/tmp/pack', 'nx', '1.0.0');

      const [, options] = execMock.mock.calls[0];
      expect(options.env.npm_config_min_release_age).toBeUndefined();
    });

    it('should disable npm min-release-age when the caller vouches for the version', async () => {
      await packageRegistryPack('/tmp/pack', 'nx', '1.0.0', {
        bypassMinReleaseAge: true,
      });

      const [, options] = execMock.mock.calls[0];
      expect(options.env.npm_config_min_release_age).toBe('0');
    });

    it('should pass --pack-destination and run from the workspace root with the overlay', async () => {
      jest
        .spyOn(configModule, 'readNxJson')
        .mockReturnValue({ cli: { packageManager: 'bun' } });
      jest.spyOn(childProcess, 'execSync').mockReturnValue('1.2.0' as any);
      (existsSync as jest.Mock).mockImplementation(
        (p: string) => p === join(workspaceRoot, 'package.json')
      );
      const overlaySpy = jest
        .spyOn(registryConfig, 'getNpmSpawnRegistryEnv')
        .mockReturnValue({
          npm_config_registry: 'https://sentinel.example.com/',
        });

      await packageRegistryPack('/tmp/pack', 'nx', '1.0.0');

      const [cmd, options] = execMock.mock.calls[0];
      expect(cmd).toContain('--pack-destination "/tmp/pack"');
      expect(options.cwd).toBe(workspaceRoot);
      expect(options.env.npm_config_registry).toBe(
        'https://sentinel.example.com/'
      );
      expect(overlaySpy).toHaveBeenNthCalledWith(
        1,
        'nx',
        workspaceRoot,
        'bun',
        '1.2.0'
      );
    });

    it('should resolve config from the Nx installation directory in a non-JS workspace', async () => {
      // Packing used to run from a temp dir seeded with .nx/installation's
      // config; running from the workspace root instead must keep resolving
      // against that directory, or a non-JS workspace loses its registry auth.
      (existsSync as jest.Mock).mockReturnValue(false);
      const overlaySpy = jest
        .spyOn(registryConfig, 'getNpmSpawnRegistryEnv')
        .mockReturnValue({});

      await packageRegistryPack('/tmp/pack', 'nx', '1.0.0');

      const installationPath = join(workspaceRoot, '.nx', 'installation');
      const [, options] = execMock.mock.calls[0];
      expect(options.cwd).toBe(installationPath);
      expect(overlaySpy.mock.calls[0][1]).toBe(installationPath);
    });
  });
});
