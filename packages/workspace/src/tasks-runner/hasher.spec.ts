import { Hasher, extractNameAndVersion } from './hasher';

const hasha = require('hasha');
const fs = require('fs');
jest.mock('hasha');
jest.mock('fs');

describe('Hasher', () => {
  let hashes = {
    'yarn.lock': 'yarn.lock.hash',
    'nx.json': 'nx.json.hash',
    'package-lock.json': 'package-lock.json.hash',
    'package.json': 'package.json.hash',
    'tsconfig.base.json': 'tsconfig.base.json.hash',
    'workspace.json': 'workspace.json.hash',
  };
  beforeEach(() => {
    hasha.mockImplementation((values) => values.join('|'));
    hasha.fromFile.mockImplementation((path) => Promise.resolve(hashes[path]));
    fs.statSync.mockReturnValue({ size: 100 });
    fs.readFileSync.mockImplementation(() =>
      JSON.stringify({ dependencies: {}, devDependencies: {} })
    );
  });

  it('should create project hash', async (done) => {
    hashes['/file'] = 'file.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proj: {
            name: 'proj',
            type: 'lib',
            data: { files: [{ file: '/file', ext: '.ts', mtime: 1 }] },
          },
        },
        dependencies: {
          proj: [],
        },
      },
      {} as any,
      {
        runtimeCacheInputs: ['echo runtime123', 'echo runtime456'],
      }
    );

    const hash = await hasher.hash({
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
    expect(hash.details.sources).toEqual({
      proj: 'file.hash',
    });
    expect(hash.details.implicitDeps).toEqual({
      'yarn.lock': 'yarn.lock.hash',
      'nx.json': 'nx.json.hash',
      'package-lock.json': 'package-lock.json.hash',
      'package.json': 'package.json.hash',
      'tsconfig.base.json': 'tsconfig.base.json.hash',
      'workspace.json': 'workspace.json.hash',
    });
    expect(hash.details.runtime).toEqual({
      'echo runtime123': 'runtime123',
      'echo runtime456': 'runtime456',
    });

    done();
  });

  it('should throw an error when failed to execute runtimeCacheInputs', async () => {
    const hasher = new Hasher(
      {
        nodes: {},
        dependencies: {},
      },
      {} as any,
      {
        runtimeCacheInputs: ['boom'],
      }
    );

    try {
      await hasher.hash({
        target: { project: 'proj', target: 'build' },
        id: 'proj-build',
        overrides: {},
      });
      fail('Should not be here');
    } catch (e) {
      expect(e.message).toContain(
        'Nx failed to execute runtimeCacheInputs defined in nx.json failed:'
      );
      expect(e.message).toContain('boom:');
      expect(e.message).toContain(' not found');
    }
  });

  it('should hash projects with dependencies', async (done) => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          parent: {
            name: 'parent',
            type: 'lib',
            data: { files: [{ file: '/filea', ext: '.ts', mtime: 1 }] },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: { files: [{ file: '/fileb', ext: '.ts', mtime: 1 }] },
          },
        },
        dependencies: {
          parent: [{ source: 'parent', target: 'child', type: 'static' }],
        },
      },
      {} as any,
      {}
    );

    const hasha = await hasher.hash({
      target: { project: 'parent', target: 'build' },
      id: 'parent-build',
      overrides: { prop: 'prop-value' },
    });

    // note that the parent hash is based on parent source files only!
    expect(hasha.details.sources).toEqual({
      parent: 'a.hash',
      child: 'b.hash',
    });

    done();
  });

  it('should hash when circular dependencies', async (done) => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proja: {
            name: 'proja',
            type: 'lib',
            data: { files: [{ file: '/filea', ext: '.ts', mtime: 1 }] },
          },
          projb: {
            name: 'projb',
            type: 'lib',
            data: { files: [{ file: '/fileb', ext: '.ts', mtime: 1 }] },
          },
        },
        dependencies: {
          proja: [{ source: 'proja', target: 'projb', type: 'static' }],
          projb: [{ source: 'projb', target: 'proja', type: 'static' }],
        },
      },
      {} as any,
      {}
    );

    const hasha = await hasher.hash({
      target: { project: 'proja', target: 'build' },
      id: 'proja-build',
      overrides: { prop: 'prop-value' },
    });

    expect(hasha.value).toContain('yarn.lock.hash'); //implicits
    expect(hasha.value).toContain('a.hash'); //project files
    expect(hasha.value).toContain('b.hash'); //project files
    expect(hasha.value).toContain('prop-value'); //overrides
    expect(hasha.value).toContain('proj'); //project
    expect(hasha.value).toContain('build'); //target
    expect(hasha.details.sources).toEqual({ proja: 'a.hash', projb: 'b.hash' });

    const hashb = await hasher.hash({
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
    expect(hashb.details.sources).toEqual({ proja: 'a.hash', projb: 'b.hash' });

    done();
  });

  it('should handle large binary files in a special way', async (done) => {
    fs.statSync.mockImplementation((f) => {
      if (f === '/file') return { size: 1000000 * 5 + 1 };
      return { size: 100 };
    });
    hashes['/file'] = 'file.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proja: {
            name: 'proj',
            type: 'lib',
            data: { files: [{ file: '/file', ext: '.ts', mtime: 1 }] },
          },
        },
        dependencies: {},
      },
      {} as any,
      {}
    );

    const hash = (
      await hasher.hash({
        target: { project: 'proja', target: 'build' },
        id: 'proja-build',
        overrides: { prop: 'prop-value' },
      })
    ).value;

    expect(hash).toContain('yarn.lock.hash'); //implicits
    expect(hash).toContain('5000001'); //project files
    expect(hash).toContain('prop-value'); //overrides
    expect(hash).toContain('proj'); //project
    expect(hash).toContain('build'); //target

    done();
  });

  describe('extractNameAndVersion', () => {
    it('should work', () => {
      const nameAndVersion = extractNameAndVersion(`
      {
        "name": "myname",
        "somethingElse": "123",
        "version": "1.1.1"
      }
    `);
      expect(nameAndVersion).toEqual(`myname1.1.1`);
    });
  });
});
