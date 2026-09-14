vi.mock('../plugins/js/utils/register', () => ({
  loadTsFile: vi.fn(() => ({ default: 'loaded' })),
  registerSourceGraphResolver: vi.fn(),
  requireWithTsconfigFallback: vi.fn(),
}));

// schema-utils retains this metadata object, so tests must mutate it in place.
const packagesMetadata = vi.hoisted(() => ({
  packageToProjectMap: {} as Record<string, ProjectConfiguration>,
  packageManagerWorkspacePackageNames: [] as string[],
  packageManagerWorkspacePackages: [] as { name: string; root: string }[],
}));
vi.mock('../plugins/js/utils/packages', () => ({
  getWorkspacePackagesMetadata: vi.fn(() => packagesMetadata),
}));

import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TempFs } from '../internal-testing-utils/temp-fs';
import {
  registerSourceGraphResolver,
  requireWithTsconfigFallback,
} from '../plugins/js/utils/register';
import { setWorkspaceRoot, workspaceRoot } from '../utils/workspace-root';
import { getImplementationFactory } from './schema-utils';
import type { ProjectConfiguration } from './workspace-json-project-json';

describe('getImplementationFactory', () => {
  it('registers workspace-local TypeScript implementations as source', () => {
    const directory = join(workspaceRoot, 'packages/nx/src');

    getImplementationFactory(
      './project-graph/plugins/resolve-plugin',
      directory,
      'local-plugin',
      {}
    )();

    expect(registerSourceGraphResolver).toHaveBeenCalledWith(
      join(directory, 'project-graph/plugins/resolve-plugin.ts'),
      workspaceRoot,
      []
    );
  });

  it('registers a realpath-resolved implementation when the workspace root is an alias', () => {
    const fs = new TempFs('schema-utils-alias-root');
    const real = realpathSync(fs.tempDir);
    const alias = join(fs.tempDir, 'alias');
    const directory = join(real, 'ws/packages/plugin/src');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'impl.ts'), '');
    symlinkSync(join(real, 'ws'), alias, 'dir');
    const originalRoot = workspaceRoot;
    setWorkspaceRoot(alias);
    try {
      getImplementationFactory('./impl', directory, 'local-plugin', {})();

      expect(registerSourceGraphResolver).toHaveBeenCalledWith(
        join(directory, 'impl.ts'),
        alias,
        []
      );
    } finally {
      setWorkspaceRoot(originalRoot);
      fs.cleanup();
    }
  });

  it('loads a default-only built exports target as built and hints at the missing sibling output', () => {
    const fs = new TempFs('schema-utils-built-exports');
    const directory = join(fs.tempDir, 'packages/plugin');
    mkdirSync(join(directory, 'dist'), { recursive: true });
    writeFileSync(join(directory, 'dist/generator.js'), '');
    const project = {
      name: 'plugin',
      root: 'packages/plugin',
      targets: {},
      metadata: {
        js: {
          packageName: '@proj/plugin',
          packageExports: { './generator': { default: './dist/generator.js' } },
        },
      },
    } as ProjectConfiguration;
    packagesMetadata.packageToProjectMap['@proj/plugin'] = project;
    packagesMetadata.packageManagerWorkspacePackageNames.push('@proj/sibling');
    packagesMetadata.packageManagerWorkspacePackages.push({
      name: '@proj/sibling',
      root: 'packages/sibling',
    });
    const notFound = Object.assign(
      new Error("Cannot find module '@proj/sibling'"),
      { code: 'MODULE_NOT_FOUND' }
    );
    vi.mocked(requireWithTsconfigFallback).mockImplementationOnce(() => {
      throw notFound;
    });
    vi.mocked(registerSourceGraphResolver).mockClear();
    const originalRoot = workspaceRoot;
    setWorkspaceRoot(fs.tempDir);
    try {
      const factory = getImplementationFactory(
        './generator',
        directory,
        '@proj/plugin',
        { plugin: project }
      );

      expect(factory).toThrow(
        '"@proj/sibling" was requested from "packages/plugin/dist/generator.js"'
      );
      expect(registerSourceGraphResolver).not.toHaveBeenCalled();
      expect(requireWithTsconfigFallback).toHaveBeenCalledWith(
        join(directory, 'dist/generator.js')
      );
    } finally {
      setWorkspaceRoot(originalRoot);
      delete packagesMetadata.packageToProjectMap['@proj/plugin'];
      packagesMetadata.packageManagerWorkspacePackageNames.length = 0;
      packagesMetadata.packageManagerWorkspacePackages.length = 0;
      fs.cleanup();
    }
  });

  it('classifies an aliased implementation against the package that declares it', () => {
    const fs = new TempFs('schema-utils-alias-source');
    const directory = join(fs.tempDir, 'packages/impl');
    mkdirSync(join(directory, 'src'), { recursive: true });
    writeFileSync(join(directory, 'src/build.js'), '');
    const alias = {
      name: 'alias',
      root: 'packages/alias',
      targets: {},
      metadata: { js: { packageName: '@proj/alias', packageExports: {} } },
    } as ProjectConfiguration;
    const impl = {
      name: 'impl',
      root: 'packages/impl',
      sourceRoot: 'packages/impl/src',
      targets: {},
      metadata: { js: { packageName: '@proj/impl', packageExports: {} } },
    } as ProjectConfiguration;
    packagesMetadata.packageToProjectMap['@proj/alias'] = alias;
    packagesMetadata.packageToProjectMap['@proj/impl'] = impl;
    vi.mocked(registerSourceGraphResolver).mockClear();
    vi.mocked(requireWithTsconfigFallback).mockReturnValue({});
    const originalRoot = workspaceRoot;
    setWorkspaceRoot(fs.tempDir);
    try {
      const projects = { alias, impl };
      // Requested as the alias, read from the declaring package.
      getImplementationFactory(
        './dist/build',
        directory,
        '@proj/alias',
        projects
      )();
      expect(registerSourceGraphResolver).not.toHaveBeenCalled();

      getImplementationFactory(
        './dist/build',
        directory,
        '@proj/alias',
        projects,
        '@proj/impl'
      )();
      expect(registerSourceGraphResolver).toHaveBeenCalledWith(
        join(directory, 'src/build.js'),
        fs.tempDir,
        []
      );
    } finally {
      setWorkspaceRoot(originalRoot);
      delete packagesMetadata.packageToProjectMap['@proj/alias'];
      delete packagesMetadata.packageToProjectMap['@proj/impl'];
      fs.cleanup();
    }
  });

  it('keeps an installed TypeScript implementation built even under a root project', () => {
    const fs = new TempFs('schema-utils-installed-ts');
    const directory = join(fs.tempDir, 'node_modules/pkg');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'impl.ts'), '');
    const root = {
      name: 'root',
      root: '.',
      targets: {},
      metadata: { js: { packageName: 'root', packageExports: {} } },
    } as ProjectConfiguration;
    packagesMetadata.packageToProjectMap['root'] = root;
    vi.mocked(registerSourceGraphResolver).mockClear();
    vi.mocked(requireWithTsconfigFallback).mockReturnValue({});
    const originalRoot = workspaceRoot;
    setWorkspaceRoot(fs.tempDir);
    try {
      getImplementationFactory('./impl', directory, 'pkg', { root })();

      expect(registerSourceGraphResolver).not.toHaveBeenCalled();
    } finally {
      setWorkspaceRoot(originalRoot);
      delete packagesMetadata.packageToProjectMap['root'];
      fs.cleanup();
    }
  });

  it('loads a JavaScript file guessed under src as source only when sourceRoot covers it', () => {
    const fs = new TempFs('schema-utils-guessed-source');
    const directory = join(fs.tempDir, 'packages/plugin');
    mkdirSync(join(directory, 'src'), { recursive: true });
    writeFileSync(join(directory, 'src/generator.js'), '');
    const project = {
      name: 'plugin',
      root: 'packages/plugin',
      targets: {},
      metadata: { js: { packageName: '@proj/plugin', packageExports: {} } },
    } as ProjectConfiguration;
    packagesMetadata.packageToProjectMap['@proj/plugin'] = project;
    vi.mocked(registerSourceGraphResolver).mockClear();
    vi.mocked(requireWithTsconfigFallback).mockReturnValue({});
    const originalRoot = workspaceRoot;
    setWorkspaceRoot(fs.tempDir);
    try {
      getImplementationFactory('./dist/generator', directory, '@proj/plugin', {
        plugin: project,
      })();
      expect(registerSourceGraphResolver).not.toHaveBeenCalled();

      project.sourceRoot = 'packages/plugin/src';
      getImplementationFactory('./dist/generator', directory, '@proj/plugin', {
        plugin: project,
      })();
      expect(registerSourceGraphResolver).toHaveBeenCalledWith(
        join(directory, 'src/generator.js'),
        fs.tempDir,
        []
      );
    } finally {
      setWorkspaceRoot(originalRoot);
      delete packagesMetadata.packageToProjectMap['@proj/plugin'];
      fs.cleanup();
    }
  });
});
