import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readJson,
  updateJson,
  workspaceRoot,
  writeJson,
  type Tree,
} from '@nx/devkit';
import configurationGenerator from './configuration';
import type { ConfigurationSchema } from './schema';

describe('rspack configuration generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // satisfy assertSupportedRspackVersion (floor 1.0.0)
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies['@rspack/core'] = '1.0.0';
      return json;
    });
  });

  // `projectIsRootProjectInStandaloneWorkspace` checks
  // `relative(workspaceRoot, projectRoot) === ''`. In a real standalone
  // workspace cwd is the workspace root, so a project root of '.' resolves to
  // it; under jest cwd is the package dir, so we run from the workspace root to
  // reproduce that resolution.
  async function runFromWorkspaceRoot(options: ConfigurationSchema) {
    const cwd = process.cwd();
    try {
      process.chdir(workspaceRoot);
      await configurationGenerator(tree, options);
    } finally {
      process.chdir(cwd);
    }
  }

  function setupReactProject(root: string) {
    addProjectConfiguration(tree, 'app', {
      root,
      sourceRoot: `${root}/src`,
      projectType: 'application',
      // a supported build executor so the generator converts without prompting
      targets: { build: { executor: '@nx/webpack:webpack', options: {} } },
    });
    const tsconfigPath =
      root === '.' ? 'tsconfig.json' : `${root}/tsconfig.json`;
    writeJson(tree, tsconfigPath, {
      compilerOptions: { jsx: 'react-jsx' },
      files: [],
      include: ['src'],
    });
    tree.write(`${root === '.' ? '' : `${root}/`}src/main.tsx`, '');
  }

  describe('standalone root project (project root ".")', () => {
    it('should inline the version-resolved base options with moduleResolution "bundler" when typescript is not declared', async () => {
      setupReactProject('.');

      await runFromWorkspaceRoot({
        project: 'app',
        framework: 'react',
        target: 'web',
        newProject: false,
        addPlugin: false,
      });

      const tsconfig = readJson(tree, 'tsconfig.json');
      // base options were inlined, not extended
      expect(tsconfig.extends).toBeUndefined();
      expect(tsconfig.compileOnSave).toBe(false);
      // version-resolved value for a >=6 (default) tree
      expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
      // base options landed
      expect(tsconfig.compilerOptions.module).toBe('esnext');
      expect(tsconfig.compilerOptions.target).toBe('es2015');
      // the TS6 change dropped esModuleInterop: false from the react block
      expect(tsconfig.compilerOptions).not.toHaveProperty('esModuleInterop');
    });

    it('should inline moduleResolution "node10" when typescript is pinned below 6', async () => {
      setupReactProject('.');
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies.typescript = '~5.9.2';
        return json;
      });

      await runFromWorkspaceRoot({
        project: 'app',
        framework: 'react',
        target: 'web',
        newProject: false,
        addPlugin: false,
      });

      const tsconfig = readJson(tree, 'tsconfig.json');
      expect(tsconfig.extends).toBeUndefined();
      expect(tsconfig.compileOnSave).toBe(false);
      expect(tsconfig.compilerOptions.moduleResolution).toBe('node10');
      expect(tsconfig.compilerOptions.module).toBe('esnext');
      expect(tsconfig.compilerOptions.target).toBe('es2015');
      expect(tsconfig.compilerOptions).not.toHaveProperty('esModuleInterop');
    });
  });

  describe('non-standalone project', () => {
    it('should extend the root tsconfig.base.json instead of inlining the base options', async () => {
      setupReactProject('apps/app');

      await configurationGenerator(tree, {
        project: 'app',
        framework: 'react',
        target: 'web',
        newProject: false,
        addPlugin: false,
      });

      const tsconfig = readJson(tree, 'apps/app/tsconfig.json');
      // non-root project extends the base config; nothing is inlined
      expect(tsconfig.extends).toBe('../../tsconfig.base.json');
      expect(tsconfig.compilerOptions).not.toHaveProperty('moduleResolution');
      expect(tsconfig.compileOnSave).toBeUndefined();
    });
  });
});
