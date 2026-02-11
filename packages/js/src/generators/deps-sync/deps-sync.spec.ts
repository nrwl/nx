import { readJson, writeJson, type ProjectGraph, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { syncGenerator } from './deps-sync';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(() => Promise.resolve(projectGraph)),
  detectPackageManager: jest.fn(() => 'npm'),
  formatFiles: jest.fn(() => Promise.resolve()),
}));

// Re-import so we can change the mock per test
import * as devkit from '@nx/devkit';
const detectPackageManagerMock = devkit.detectPackageManager as jest.Mock;

describe('deps-sync syncGenerator()', () => {
  let tree: Tree;

  function addProject(
    name: string,
    dependencies: string[] = [],
    {
      packageName,
      root,
      existingDevDeps,
      existingDeps,
      noPackageJson,
    }: {
      packageName?: string;
      root?: string;
      existingDevDeps?: Record<string, string>;
      existingDeps?: Record<string, string>;
      noPackageJson?: boolean;
    } = {}
  ) {
    const projectRoot = root ?? `packages/${name}`;
    const resolvedPackageName = packageName ?? name;

    projectGraph.nodes[name] = {
      name,
      type: 'lib',
      data: {
        root: projectRoot,
        metadata: noPackageJson
          ? undefined
          : {
              js: {
                packageName: resolvedPackageName,
              },
            },
      },
    };
    projectGraph.dependencies[name] = dependencies.map((dep) => ({
      type: 'static',
      source: name,
      target: dep,
    }));

    if (!noPackageJson) {
      const pkgJson: Record<string, unknown> = {
        name: resolvedPackageName,
        version: '0.0.0',
      };
      if (existingDevDeps) {
        pkgJson.devDependencies = existingDevDeps;
      }
      if (existingDeps) {
        pkgJson.dependencies = existingDeps;
      }
      writeJson(tree, `${projectRoot}/package.json`, pkgJson);
    }
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
    detectPackageManagerMock.mockReturnValue('npm');
  });

  it('should add missing devDependencies for internal deps (npm)', async () => {
    addProject('a');
    addProject('b', ['a']);

    const result = await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toEqual({ a: '*' });
    expect(result).toBeDefined();
    expect((result as any).outOfSyncMessage).toContain(
      'missing devDependencies'
    );
  });

  it('should use workspace:* for yarn', async () => {
    detectPackageManagerMock.mockReturnValue('yarn');
    addProject('a');
    addProject('b', ['a']);

    await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toEqual({ a: 'workspace:*' });
  });

  it('should use workspace:* for pnpm', async () => {
    detectPackageManagerMock.mockReturnValue('pnpm');
    addProject('a');
    addProject('b', ['a']);

    await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toEqual({ a: 'workspace:*' });
  });

  it('should use workspace:* for bun', async () => {
    detectPackageManagerMock.mockReturnValue('bun');
    addProject('a');
    addProject('b', ['a']);

    await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toEqual({ a: 'workspace:*' });
  });

  it('should remove stale internal devDependencies', async () => {
    addProject('a');
    addProject('c');
    // b used to depend on c, but now only depends on a
    addProject('b', ['a'], {
      existingDevDeps: { a: '*', c: '*' },
    });

    await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toEqual({ a: '*' });
  });

  it('should not remove external devDependencies', async () => {
    addProject('a');
    addProject('b', ['a'], {
      existingDevDeps: { jest: '^29.0.0' },
    });

    await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toEqual({ a: '*', jest: '^29.0.0' });
  });

  it('should not add devDependency if already in dependencies', async () => {
    addProject('a');
    addProject('b', ['a'], {
      existingDeps: { a: '*' },
    });

    const result = await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toBeUndefined();
    expect(pkgJson.dependencies).toEqual({ a: '*' });
    // No changes, so result should be void/undefined
    expect(result).toBeUndefined();
  });

  it('should return undefined when everything is in sync', async () => {
    addProject('a');
    addProject('b', ['a'], {
      existingDevDeps: { a: '*' },
    });

    const result = await syncGenerator(tree);

    expect(result).toBeUndefined();
  });

  it('should skip projects without package name (no metadata)', async () => {
    addProject('a', [], { noPackageJson: true });
    addProject('b', ['a']);

    const result = await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    // a has no packageName, so no devDep should be added
    expect(pkgJson.devDependencies).toBeUndefined();
    expect(result).toBeUndefined();
  });

  it('should skip consumer projects without package name', async () => {
    addProject('a');
    addProject('b', ['a'], { noPackageJson: true });

    const result = await syncGenerator(tree);

    // b has no package.json / metadata, so nothing happens
    expect(result).toBeUndefined();
  });

  it('should skip the root project as a consumer', async () => {
    addProject('a');
    // Root project depends on 'a', but being root ('.') it should be skipped
    addProject('root-proj', ['a'], { root: '.' });

    const result = await syncGenerator(tree);

    // root project is excluded as a consumer, so no changes
    expect(result).toBeUndefined();
  });

  it('should skip implicit dependencies', async () => {
    addProject('a');
    projectGraph.nodes['b'] = {
      name: 'b',
      type: 'lib',
      data: {
        root: 'packages/b',
        metadata: { js: { packageName: 'b' } },
      },
    };
    projectGraph.dependencies['b'] = [
      { type: 'implicit', source: 'b', target: 'a' },
    ];
    writeJson(tree, 'packages/b/package.json', {
      name: 'b',
      version: '0.0.0',
    });

    const result = await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toBeUndefined();
    expect(result).toBeUndefined();
  });

  it('should update wrong version string', async () => {
    addProject('a');
    addProject('b', ['a'], {
      existingDevDeps: { a: '1.0.0' },
    });

    await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toEqual({ a: '*' });
  });

  it('should handle multiple dependencies', async () => {
    addProject('a');
    addProject('c');
    addProject('b', ['a', 'c']);

    await syncGenerator(tree);

    const pkgJson = readJson(tree, 'packages/b/package.json');
    expect(pkgJson.devDependencies).toEqual({ a: '*', c: '*' });
  });

  it('should provide detailed out-of-sync info', async () => {
    addProject('a');
    addProject('c');
    // b depends on a (will be added) and has stale dep on c (will be removed)
    addProject('b', ['a'], {
      existingDevDeps: { c: '*' },
    });

    const result = await syncGenerator(tree);

    expect(result).toBeDefined();
    expect((result as any).outOfSyncDetails).toBeDefined();
    const details = (result as any).outOfSyncDetails.join('\n');
    expect(details).toMatchInlineSnapshot(`
      "packages/b/package.json:
        - Missing devDependencies: a
        - Stale devDependencies: c"
    `);
  });
});
