import { addProjectConfiguration, readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import migration from './add-eas-build-pre-install';

const hookCommand =
  'cd ../../ && node tools/scripts/eas-build-pre-install.mjs . apps/mobile';

function addExpoApp(tree: Tree, scripts?: Record<string, string>) {
  addProjectConfiguration(tree, 'mobile', { root: 'apps/mobile' });
  tree.write('apps/mobile/eas.json', '{}');
  tree.write(
    'apps/mobile/package.json',
    JSON.stringify({ name: 'mobile', dependencies: { expo: '*' }, scripts })
  );
}

describe('add-eas-build-pre-install', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add the hook and its script to Expo apps', async () => {
    addExpoApp(tree, {
      'eas-build-post-install':
        'cd ../../ && node tools/scripts/eas-build-post-install.mjs . apps/mobile',
    });

    const result = await migration(tree);

    expect(readJson(tree, 'apps/mobile/package.json').scripts).toEqual({
      'eas-build-pre-install': hookCommand,
      'eas-build-post-install':
        'cd ../../ && node tools/scripts/eas-build-post-install.mjs . apps/mobile',
    });
    expect(tree.exists('tools/scripts/eas-build-pre-install.mjs')).toBe(true);
    expect(tree.exists('tools/scripts/eas-build-post-install.mjs')).toBe(false);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should not touch projects without eas.json', async () => {
    addProjectConfiguration(tree, 'lib', { root: 'libs/lib' });
    tree.write('libs/lib/package.json', JSON.stringify({ name: 'lib' }));
    const before = tree.read('libs/lib/package.json', 'utf-8');

    const result = await migration(tree);

    expect(tree.read('libs/lib/package.json', 'utf-8')).toBe(before);
    expect(tree.exists('tools/scripts/eas-build-pre-install.mjs')).toBe(false);
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should be idempotent', async () => {
    addExpoApp(tree);
    await migration(tree);
    const packageJson = tree.read('apps/mobile/package.json', 'utf-8');
    const script = tree.read(
      'tools/scripts/eas-build-pre-install.mjs',
      'utf-8'
    );

    const result = await migration(tree);

    expect(tree.read('apps/mobile/package.json', 'utf-8')).toBe(packageJson);
    expect(tree.read('tools/scripts/eas-build-pre-install.mjs', 'utf-8')).toBe(
      script
    );
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should keep an existing eas-build-pre-install script and report it', async () => {
    addExpoApp(tree, { 'eas-build-pre-install': 'echo custom' });

    const result = await migration(tree);

    expect(
      readJson(tree, 'apps/mobile/package.json').scripts[
        'eas-build-pre-install'
      ]
    ).toBe('echo custom');
    expect(tree.exists('tools/scripts/eas-build-pre-install.mjs')).toBe(true);
    expect(result).toEqual({
      nextSteps: [
        `apps/mobile/package.json already defines "eas-build-pre-install". Make it also run "${hookCommand}".`,
      ],
      agentContext: [
        `apps/mobile/package.json already defines "eas-build-pre-install". Make it also run "${hookCommand}".`,
      ],
    });
  });

  describe('eas-build-pre-install.mjs', () => {
    let root: string;

    async function runHook(files: Record<string, string>) {
      for (const [path, content] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), content);
      }
      const scriptTree = createTreeWithEmptyWorkspace();
      addExpoApp(scriptTree);
      await migration(scriptTree);
      const scriptPath = join(root, 'tools/scripts/eas-build-pre-install.mjs');
      mkdirSync(join(root, 'tools/scripts'), { recursive: true });
      writeFileSync(
        scriptPath,
        scriptTree.read('tools/scripts/eas-build-pre-install.mjs', 'utf-8')
      );
      execFileSync(process.execPath, [scriptPath, '.', 'apps/mobile'], {
        cwd: root,
        stdio: 'pipe',
      });
    }

    function readProjectPackageJson() {
      return JSON.parse(
        readFileSync(join(root, 'apps/mobile/package.json'), 'utf-8')
      );
    }

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'eas-pre-install-'));
    });

    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
    });

    it('should copy root dependencies, overrides and the lock file', async () => {
      await runHook({
        'package.json': JSON.stringify({
          dependencies: { expo: '~53.0.0' },
          devDependencies: { jest: '^30.0.0' },
          overrides: { semver: '7.6.0' },
          resolutions: { semver: '7.5.0' },
        }),
        'package-lock.json': '{"lockfileVersion":3}',
        'apps/mobile/package.json': JSON.stringify({
          name: 'mobile',
          dependencies: { expo: '*' },
        }),
      });

      expect(readProjectPackageJson()).toEqual({
        name: 'mobile',
        dependencies: { expo: '~53.0.0' },
        devDependencies: { jest: '^30.0.0' },
        overrides: { semver: '7.6.0' },
      });
      expect(
        readFileSync(join(root, 'apps/mobile/package-lock.json'), 'utf-8')
      ).toBe('{"lockfileVersion":3}');
    });

    it('should copy resolutions when there are no overrides', async () => {
      await runHook({
        'package.json': JSON.stringify({
          dependencies: { expo: '~53.0.0' },
          resolutions: { semver: '7.5.0' },
        }),
        'yarn.lock': '# yarn lockfile v1',
        'apps/mobile/package.json': JSON.stringify({ name: 'mobile' }),
      });

      expect(readProjectPackageJson().resolutions).toEqual({
        semver: '7.5.0',
      });
      expect(existsSync(join(root, 'apps/mobile/yarn.lock'))).toBe(true);
    });

    it('should copy the root pnpm settings', async () => {
      await runHook({
        'package.json': JSON.stringify({
          dependencies: { expo: '~53.0.0' },
          pnpm: { overrides: { semver: '7.6.0' } },
        }),
        'pnpm-lock.yaml': "lockfileVersion: '9.0'",
        'apps/mobile/package.json': JSON.stringify({ name: 'mobile' }),
      });

      expect(readProjectPackageJson()).toEqual({
        name: 'mobile',
        dependencies: { expo: '~53.0.0' },
        pnpm: { overrides: { semver: '7.6.0' } },
      });
    });

    it('should use the root package name with yarn', async () => {
      await runHook({
        'package.json': JSON.stringify({
          name: '@org/source',
          dependencies: { expo: '~53.0.0' },
        }),
        'yarn.lock': '__metadata:\n  version: 8\n',
        'apps/mobile/package.json': JSON.stringify({ name: 'mobile' }),
      });

      expect(readProjectPackageJson().name).toBe('@org/source');
    });

    it('should use the package manager configured in nx.json', async () => {
      await runHook({
        'nx.json': JSON.stringify({ cli: { packageManager: 'npm' } }),
        'package.json': JSON.stringify({ dependencies: { expo: '~53.0.0' } }),
        'pnpm-lock.yaml': "lockfileVersion: '9.0'",
        'package-lock.json': '{}',
        'apps/mobile/package.json': JSON.stringify({ name: 'mobile' }),
      });

      expect(existsSync(join(root, 'apps/mobile/package-lock.json'))).toBe(
        true
      );
      expect(existsSync(join(root, 'apps/mobile/pnpm-lock.yaml'))).toBe(false);
    });

    it.each([
      [
        'npm workspaces',
        {
          'package.json': JSON.stringify({ workspaces: ['apps/*'] }),
          'package-lock.json': '{}',
        },
      ],
      [
        'pnpm workspaces',
        {
          'package.json': JSON.stringify({}),
          'pnpm-lock.yaml': "lockfileVersion: '9.0'",
          'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n",
        },
      ],
    ])('should change nothing with %s', async (_, files) => {
      const projectPackageJson = JSON.stringify({
        name: 'mobile',
        dependencies: { expo: '*' },
      });

      await runHook({
        ...files,
        'apps/mobile/package.json': projectPackageJson,
      });

      expect(
        readFileSync(join(root, 'apps/mobile/package.json'), 'utf-8')
      ).toBe(projectPackageJson);
      expect(existsSync(join(root, 'apps/mobile/package-lock.json'))).toBe(
        false
      );
      expect(existsSync(join(root, 'apps/mobile/pnpm-lock.yaml'))).toBe(false);
    });
  });
});
