// This must come before the Hasher import
jest.doMock('@nrwl/tao/src/utils/app-root', () => {
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
    npmScope: 'nrwl',
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
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: '',
              files: [{ file: '/filea.ts', hash: 'a.hash' }],
            },
          },
        },
        externalNodes: {
          'npm:react': {
            name: 'npm:react',
            type: 'npm',
            data: {
              version: '17.0.0',
              packageName: 'react',
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
      app: '/filea.ts|a.hash|""|{"compilerOptions":{"paths":{"@nrwl/parent":["libs/parent/src/index.ts"],"@nrwl/child":["libs/child/src/index.ts"]}}}',
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

  it('should hash implicit dependencies', async () => {
    const packageJson = {
      name: '@myorg/package',
      version: '0.0.1',
      scripts: {
        build: 'build script',
        'check:1': 'check:1 script',
        'check:2': 'check:2 script',
        lint: 'lint script',
        test: 'test script',
      },
      dependencies: { package1: '1.0.0', package2: '1.0.0' },
      devDependencies: { package3: '1.0.0', mypackage: '1.0.0' },
    };
    const someConfig = { key1: 'value1', key2: 'value2' };
    fs.readFileSync = (file) => {
      if (file.endsWith('package.json')) {
        return JSON.stringify(packageJson);
      }
      if (file.endsWith('some-config.json')) {
        return JSON.stringify(someConfig);
      }
      return file;
    };
    hashes['globalFile1'] = 'globalFile1.hash';
    hashes['globalFile2'] = 'globalFile2.hash';
    hashes['styles/style1.css'] = 'styles/style1.css.hash';
    hashes['styles/subfolder/style2.css'] = 'styles/subfolder/style2.css.hash';
    hashes['some-config.json'] = 'some-config.json.hash';
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: { root: '', files: [] },
          },
          proja: { name: 'proja', type: 'lib', data: { root: '', files: [] } },
          projb: { name: 'projb', type: 'lib', data: { root: '', files: [] } },
        },
        dependencies: {},
        allWorkspaceFiles: [
          { file: 'angular.json', hash: 'hash1' },
          { file: 'package.json', hash: 'hash2' },
          { file: 'globalFile1', hash: 'hash3' },
          { file: 'globalFile2', hash: 'hash4' },
          { file: 'styles/style1.css', hash: 'hash5' },
          { file: 'styles/subfolder/style2.css', hash: 'hash6' },
        ],
      },
      {
        implicitDependencies: {
          'workspace.json': '*',
          'package.json': {
            dependencies: '*',
            devDependencies: { mypackage: ['proja'] },
            scripts: {
              'check:*': '*',
              lint: ['proja'],
              // non-existent keys
              baz: '*',
              foo: { bar: ['projb'] },
            },
            bazz: '*', // non-existent key
          },
          globalFile1: ['parent'],
          globalFile2: ['proja'],
          'styles/**/*.css': ['parent'],
          'some-config.json': { key1: ['parent'] },
          'foo.json': { a: '*' }, // non-existent file
        },
      } as any,
      {},
      createHashing()
    );
    const parentPackageJson = {
      dependencies: packageJson.dependencies,
      scripts: {
        'check:1': packageJson.scripts['check:1'],
        'check:2': packageJson.scripts['check:2'],
      },
    };
    const projAPackageJson = {
      devDependencies: { mypackage: packageJson.devDependencies['mypackage'] },
      scripts: {
        lint: packageJson.scripts['lint'],
        'check:1': packageJson.scripts['check:1'],
        'check:2': packageJson.scripts['check:2'],
      },
      dependencies: packageJson.dependencies,
    };
    const projBPackageJson = {
      scripts: {
        'check:1': packageJson.scripts['check:1'],
        'check:2': packageJson.scripts['check:2'],
      },
      dependencies: packageJson.dependencies,
    };
    const parentSomeConfig = { key1: someConfig.key1 };

    const tasksHashParent = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });
    const tasksHashProjectA = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'proja', target: 'build' },
      id: 'proja-build',
      overrides: { prop: 'prop-value' },
    });
    const tasksHashProjectB = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'projb', target: 'build' },
      id: 'projb-build',
      overrides: { prop: 'prop-value' },
    });

    // parent
    expect(tasksHashParent.value).toContain('workspace.json.hash');
    expect(tasksHashParent.value).toContain(JSON.stringify(parentPackageJson));
    expect(tasksHashParent.details.implicitDeps['package.json']).toBe(
      JSON.stringify(parentPackageJson)
    );
    expect(tasksHashParent.value).toContain('globalFile1.hash');
    expect(tasksHashParent.value).not.toContain('globalFile2.hash');
    expect(tasksHashParent.value).toContain('styles/style1.css.hash');
    expect(tasksHashParent.value).toContain('styles/subfolder/style2.css.hash');
    expect(tasksHashParent.value).toContain(JSON.stringify(parentSomeConfig));
    expect(tasksHashParent.details.implicitDeps['some-config.json']).toBe(
      JSON.stringify(parentSomeConfig)
    );
    expect(tasksHashProjectB.details.implicitDeps['foo.json']).toBeUndefined();
    // proja
    expect(tasksHashProjectA.value).toContain('workspace.json.hash');
    expect(tasksHashProjectA.value).toContain(JSON.stringify(projAPackageJson));
    expect(tasksHashProjectA.details.implicitDeps['package.json']).toBe(
      JSON.stringify(projAPackageJson)
    );
    expect(tasksHashProjectA.value).not.toContain('globalFile1.hash');
    expect(tasksHashProjectA.value).toContain('globalFile2.hash');
    expect(tasksHashProjectA.value).not.toContain('styles/style1.css.hash');
    expect(tasksHashProjectA.value).not.toContain(
      'styles/subfolder/style2.css.hash'
    );
    expect(
      tasksHashProjectA.details.implicitDeps['some-config.json']
    ).toBeUndefined();
    expect(tasksHashProjectB.details.implicitDeps['foo.json']).toBeUndefined();
    // projb
    expect(tasksHashProjectB.value).toContain('workspace.json.hash');
    expect(tasksHashProjectB.value).toContain(JSON.stringify(projBPackageJson));
    expect(tasksHashProjectB.details.implicitDeps['package.json']).toBe(
      JSON.stringify(projBPackageJson)
    );
    expect(tasksHashProjectB.value).not.toContain('globalFile1.hash');
    expect(tasksHashProjectB.value).not.toContain('globalFile2.hash');
    expect(tasksHashProjectB.value).not.toContain('styles/style1.css.hash');
    expect(tasksHashProjectB.value).not.toContain(
      'styles/subfolder/style2.css.hash'
    );
    expect(
      tasksHashProjectB.details.implicitDeps['some-config.json']
    ).toBeUndefined();
    expect(tasksHashProjectB.details.implicitDeps['foo.json']).toBeUndefined();
  });
});
