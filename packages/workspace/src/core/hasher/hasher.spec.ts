import { Hasher } from './hasher';
import fs = require('fs');

jest.mock('fs');

describe('Hasher', () => {
  let hashes = {
    'yarn.lock': 'yarn.lock.hash',
    'nx.json': 'nx.json.hash',
    'package-lock.json': 'package-lock.json.hash',
    'package.json': 'package.json.hash',
    'pnpm-lock.yaml': 'pnpm-lock.yaml.hash',
    'tsconfig.base.json': 'tsconfig.base.json.hash',
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

  it('should create project hash', async () => {
    fs.readFileSync = (file) => {
      if (file === 'workspace.json') {
        return JSON.stringify({
          projects: { proj: { root: 'proj-from-workspace.json' } },
        });
      }
      if (file === 'nx.json') {
        return JSON.stringify({ projects: { proj: 'proj-from-nx.json' } });
      }
      return file;
    };
    hashes['/file'] = 'file.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proj: {
            name: 'proj',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/file', ext: '.ts', hash: 'file.hash' }],
            },
          },
        },
        dependencies: {
          proj: [],
        },
      },
      {} as any,
      {
        runtimeCacheInputs: ['echo runtime123', 'echo runtime456'],
      },
      createHashing()
    );

    const hash = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'proj', target: 'build' },
      id: 'proj-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hash.value).toContain('yarn.lock.hash'); //implicits
    expect(hash.value).toContain('file.hash'); //project files
    expect(hash.value).toContain('prop-value'); //overrides
    expect(hash.value).toContain('proj'); //project
    expect(hash.value).toContain('build'); //target
    expect(hash.value).toContain('runtime123'); //target
    expect(hash.value).toContain('runtime456'); //target

    expect(hash.details.command).toEqual('proj|build||{"prop":"prop-value"}');
    expect(hash.details.nodes).toEqual({
      proj: '/file|file.hash|{"root":"proj-from-workspace.json"}|"proj-from-nx.json"',
    });
    expect(hash.details.implicitDeps).toEqual({
      'yarn.lock': 'yarn.lock.hash',
      'nx.json': '{}',
      'package-lock.json': 'package-lock.json.hash',
      'pnpm-lock.yaml': 'pnpm-lock.yaml.hash',
      'tsconfig.base.json': 'tsconfig.base.json.hash',
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
          proj: {
            name: 'proj',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/file', ext: '.ts', hash: 'some-hash' }],
            },
          },
        },
        dependencies: {
          proj: [],
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
        target: { project: 'proj', target: 'build' },
        id: 'proj-build',
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
              files: [{ file: '/filea', ext: '.ts', hash: 'a.hash' }],
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/fileb', ext: '.ts', hash: 'b.hash' }],
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
      parent: '/filea|a.hash|""|""',
      child: '/fileb|b.hash|""|""',
    });
  });

  it('should hash when circular dependencies', async () => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proja: {
            name: 'proja',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/filea', ext: '.ts', hash: 'a.hash' }],
            },
          },
          projb: {
            name: 'projb',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/fileb', ext: '.ts', hash: 'b.hash' }],
            },
          },
        },
        dependencies: {
          proja: [{ source: 'proja', target: 'projb', type: 'static' }],
          projb: [{ source: 'projb', target: 'proja', type: 'static' }],
        },
      },
      {} as any,
      {},
      createHashing()
    );

    const tasksHash = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'proja', target: 'build' },
      id: 'proja-build',
      overrides: { prop: 'prop-value' },
    });

    expect(tasksHash.value).toContain('yarn.lock.hash'); //implicits
    expect(tasksHash.value).toContain('a.hash'); //project files
    expect(tasksHash.value).toContain('b.hash'); //project files
    expect(tasksHash.value).toContain('prop-value'); //overrides
    expect(tasksHash.value).toContain('proj'); //project
    expect(tasksHash.value).toContain('build'); //target
    expect(tasksHash.details.nodes).toEqual({
      proja: '/filea|a.hash|""|""',
      projb: '/fileb|b.hash|""|""',
    });

    const hashb = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'projb', target: 'build' },
      id: 'projb-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hashb.value).toContain('yarn.lock.hash'); //implicits
    expect(hashb.value).toContain('a.hash'); //project files
    expect(hashb.value).toContain('b.hash'); //project files
    expect(hashb.value).toContain('prop-value'); //overrides
    expect(hashb.value).toContain('proj'); //project
    expect(hashb.value).toContain('build'); //target
    expect(hashb.details.nodes).toEqual({
      proja: '/filea|a.hash|""|""',
      projb: '/fileb|b.hash|""|""',
    });
  });

  it('should hash implicit deps', async () => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proja: {
            name: 'proja',
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
            ext: '',
          },
          {
            file: 'global2',
            hash: 'hash2',
            ext: '',
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
      target: { project: 'proja', target: 'build' },
      id: 'proja-build',
      overrides: { prop: 'prop-value' },
    });

    expect(tasksHash.value).toContain('global1.hash');
    expect(tasksHash.value).toContain('global2.hash');
  });

  it('should exclude unlisted implicit deps from hashing', async () => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    hashes['global'] = 'global.hash';
    hashes['globalB'] = 'globalB.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proja: {
            name: 'proja',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/filea', ext: '.ts', hash: 'a.hash' }],
            },
          },
          projb: {
            name: 'projb',
            type: 'lib',
            data: {
              root: '',
              files: [{ file: '/fileb', ext: '.ts', hash: 'b.hash' }],
            },
          },
        },
        dependencies: {},
        allWorkspaceFiles: [
          {
            file: 'global',
            hash: 'global.hash',
            ext: '',
          },
          {
            file: 'globalB',
            hash: 'globalB.hash',
            ext: '',
          },
        ],
      },
      {
        projects: {
          proja: {},
          projb: {},
        },
        implicitDependencies: {
          global: '*',
          globalB: ['projb'],
        },
      } as any,
      {},
      createHashing()
    );

    const hasha = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'proja', target: 'build' },
      id: 'proja-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hasha.value).toContain('global.hash');
    expect(hasha.value).not.toContain('globalB.hash');

    const hashb = await hasher.hashTaskWithDepsAndContext({
      target: { project: 'projb', target: 'build' },
      id: 'projb-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hashb.value).toContain('global.hash');
    expect(hashb.value).toContain('globalB.hash');
  });
});
