// This must come before the Hasher import
jest.doMock('../../utils/app-root', () => {
  return {
    appRootPath: '',
  };
});

import fs = require('fs');
import { DependencyType } from '@nrwl/devkit';
import { Hasher } from './hasher';

jest.mock('fs');

fs.existsSync = () => true;

describe('Hasher', () => {
  const nxJson = {
    npmScope: 'nrwl'
  };

  const workSpaceJson = {
    projects: {
      parent: { root: 'libs/parent' },
      child: { root: 'libs/child' },
    },
  };

  const tsConfigBaseJsonHash = JSON.stringify({
    compilerOptions: {
      paths: {
        '@nrwl/parent': ['libs/parent/src/index.ts'],
        '@nrwl/child': ['libs/child/src/index.ts'],
      },
    },
  });
  let hashes = {
    'yarn.lock': 'yarn.lock.hash',
    'nx.json': 'nx.json.hash',
    'package-lock.json': 'package-lock.json.hash',
    'package.json': 'package.json.hash',
    'pnpm-lock.yaml': 'pnpm-lock.yaml.hash',
    'tsconfig.base.json': tsConfigBaseJsonHash,
    'workspace.json': 'workspace.json.hash',
    global1: 'global1.hash',
    global2: 'global2.hash',
  };

  function createHashing(): any {
    return {
      hashArray: (values: string[]) => values.join('|'),
      hashFile: (path: string) => hashes[path],
    };
  }

  beforeAll(() => {
    fs.readFileSync = (file) => {
      if (file === 'workspace.json') {
        return JSON.stringify(workSpaceJson);
      }
      if (file === 'nx.json') {
        return JSON.stringify(nxJson);
      }
      if (file === 'tsconfig.base.json') {
        return tsConfigBaseJsonHash;
      }
      return file;
    };
  });

  it('should create project hash', async () => {
    hashes['/file'] = 'file.hash';
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/file', ext: '.ts', hash: 'file.hash' }],
            },
          },
        },
        dependencies: {
          parent: [],
        },
      },
      {} as any,
      {
        runtimeCacheInputs: ['echo runtime123', 'echo runtime456'],
      },
      createHashing()
    );

    const hash = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hash.value).toContain('yarn.lock.hash'); //implicits
    expect(hash.value).toContain('file.hash'); //project files
    expect(hash.value).toContain('prop-value'); //overrides
    expect(hash.value).toContain('parent'); //project
    expect(hash.value).toContain('build'); //target
    expect(hash.value).toContain('runtime123'); //target
    expect(hash.value).toContain('runtime456'); //target

    expect(hash.details.command).toEqual('parent|build||{"prop":"prop-value"}');
    expect(hash.details.nodes).toEqual({
      parent:
        '/file|file.hash|{"root":"libs/parent"}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });
    expect(hash.details.implicitDeps).toEqual({
      'nx.json': '{"npmScope":"nrwl"}',
      'yarn.lock': 'yarn.lock.hash',
      'package-lock.json': 'package-lock.json.hash',
      'pnpm-lock.yaml': 'pnpm-lock.yaml.hash',
    });
    expect(hash.details.runtime).toEqual({
      'echo runtime123': 'runtime123',
      'echo runtime456': 'runtime456',
    });
  });

  it('should create project hash with tsconfig.base.json cache', async () => {
    hashes['/file'] = 'file.hash';
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/file.ts', hash: 'file.hash' }],
            },
          },
        },
        dependencies: {
          parent: [],
        },
      },
      {} as any,
      {
        runtimeCacheInputs: ['echo runtime123', 'echo runtime456'],
        selectivelyHashTsConfig: true,
      },
      createHashing()
    );

    const hash = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hash.value).toContain('yarn.lock.hash'); //implicits
    expect(hash.value).toContain('file.hash'); //project files
    expect(hash.value).toContain('prop-value'); //overrides
    expect(hash.value).toContain('parent'); //project
    expect(hash.value).toContain('build'); //target
    expect(hash.value).toContain('runtime123'); //target
    expect(hash.value).toContain('runtime456'); //target

    expect(hash.details.command).toEqual('parent|build||{"prop":"prop-value"}');
    expect(hash.details.nodes).toEqual({
      parent:
        '/file.ts|file.hash|{"root":"libs/parent"}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"]}}}',
    });
    expect(hash.details.implicitDeps).toEqual({
      'nx.json': '{"npmScope":"nrwl"}',
      'yarn.lock': 'yarn.lock.hash',
      'package-lock.json': 'package-lock.json.hash',
      'pnpm-lock.yaml': 'pnpm-lock.yaml.hash',
    });
    expect(hash.details.runtime).toEqual({
      'echo runtime123': 'runtime123',
      'echo runtime456': 'runtime456',
    });
  });

  it('should throw an error when failed to execute runtimeCacheInputs', async () => {
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/file.ts', hash: 'some-hash' }],
            },
          },
        },
        dependencies: {
          parent: [],
        },
      },
      {} as any,
      {
        runtimeCacheInputs: ['boom'],
      },
      createHashing()
    );

    try {
      await hasher.hashTaskWithDepsAndContext({
        target: { project: 'parent', target: 'build' },
        id: 'parent-build',
        overrides: {},
      });
      fail('Should not be here');
    } catch (e) {
      expect(e.message).toContain(
        'Nx failed to execute runtimeCacheInputs defined in nx.json failed:'
      );
      expect(e.message).toContain('boom');
      expect(
        e.message.includes(' not found') || e.message.includes('not recognized')
      ).toBeTruthy();
    }
  });

  it('should hash projects with dependencies', async () => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/filea.ts', hash: 'a.hash' }],
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/fileb.ts', hash: 'b.hash' }],
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
      },
      {} as any,
      {},
      createHashing()
    );

    const hash = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    // note that the parent hash is based on parent source files only!
    expect(hash.details.nodes).toEqual({
      child:
        '/fileb.ts|b.hash|{"root":"libs/child"}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      parent:
        '/filea.ts|a.hash|{"root":"libs/parent"}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });
  });

  it('should hash dependent npm project versions', async () => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          'npm:react': {
            name: 'parent',
            type: 'npm',
            data: {
              version: '17.0.0',
            },
          },
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: '',
              files: [{ file: '/filea.ts', hash: 'a.hash' }],
            },
          },
        },
        dependencies: {
          'npm:react': [],
          app: [
            { source: 'app', target: 'npm:react', type: DependencyType.static },
          ],
        },
      },
      {} as any,
      {},
      createHashing()
    );

    const hash = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'app', target: 'build' },
      id: 'app-build',
      overrides: { prop: 'prop-value' },
    });

    // note that the parent hash is based on parent source files only!
    expect(hash.details.nodes).toEqual({
      app: '/filea.ts|a.hash|""|""|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      'npm:react': '17.0.0',
    });
  });

  it('should hash when circular dependencies', async () => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/filea.ts', hash: 'a.hash' }],
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/fileb.ts', hash: 'b.hash' }],
            },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
          child: [{ source: 'child', target: 'parent', type: 'static' }],
        },
      },
      {} as any,
      {},
      createHashing()
    );

    const tasksHash = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(tasksHash.value).toContain('yarn.lock.hash'); //implicits
    expect(tasksHash.value).toContain('a.hash'); //project files
    expect(tasksHash.value).toContain('b.hash'); //project files
    expect(tasksHash.value).toContain('prop-value'); //overrides
    expect(tasksHash.value).toContain('parent|build'); //project and target
    expect(tasksHash.value).toContain('build'); //target
    expect(tasksHash.details.nodes).toEqual({
      child:
        '/fileb.ts|b.hash|{"root":"libs/child"}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      parent:
        '/filea.ts|a.hash|{"root":"libs/parent"}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });

    const hashb = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'child', target: 'build' },
      id: 'child-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hashb.value).toContain('yarn.lock.hash'); //implicits
    expect(hashb.value).toContain('a.hash'); //project files
    expect(hashb.value).toContain('b.hash'); //project files
    expect(hashb.value).toContain('prop-value'); //overrides
    expect(hashb.value).toContain('child|build'); //project and target
    expect(hashb.value).toContain('build'); //target
    expect(hashb.details.nodes).toEqual({
      child:
        '/fileb.ts|b.hash|{"root":"libs/child"}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
      parent:
        '/filea.ts|a.hash|{"root":"libs/parent"}|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
    });
  });

  it('should hash implicit deps', async () => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: {
              root: '',
              files: [],
            },
          },
        },
        dependencies: {},
        allWorkspaceFiles: [
          {
            file: 'global1',
            hash: 'hash1',
          },
          {
            file: 'global2',
            hash: 'hash2',
          },
        ],
      },
      {
        implicitDependencies: {
          'global*': '*',
        },
      } as any,
      {},
      createHashing()
    );

    const tasksHash = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    expect(tasksHash.value).toContain('global1.hash');
    expect(tasksHash.value).toContain('global2.hash');
  });
});
