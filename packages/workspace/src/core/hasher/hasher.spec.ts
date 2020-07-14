import { Hasher } from './hasher';
import { extractNameAndVersion } from '@nrwl/workspace/src/core/hasher/file-hasher';

const fs = require('fs');
jest.mock('fs');

describe('Hasher', () => {
  let hashes = {
    'yarn.lock': 'yarn.lock.hash',
    'nx.json': 'nx.json.hash',
    'package-lock.json': 'package-lock.json.hash',
    'package.json': 'package.json.hash',
    'tsconfig.json': 'tsconfig.json.hash',
    'workspace.json': 'workspace.json.hash',
  };

  function createHashing(): any {
    return {
      hashArray: (values: string[]) => values.join('|'),
      hashFile: (path: string) => hashes[path],
    };
  }

  it('should create project hash', async (done) => {
    hashes['/file'] = 'file.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proj: {
            name: 'proj',
            type: 'lib',
            data: { files: [{ file: '/file', ext: '.ts', hash: 'some-hash' }] },
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

    const hash = (
      await hasher.hashTasks([
        {
          target: { project: 'proj', target: 'build' },
          id: 'proj-build',
          overrides: { prop: 'prop-value' },
        },
      ])
    )[0];

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
      'tsconfig.json': 'tsconfig.json.hash',
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
      },
      createHashing()
    );

    try {
      await hasher.hashTasks([
        {
          target: { project: 'proj', target: 'build' },
          id: 'proj-build',
          overrides: {},
        },
      ]);
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
            data: {
              files: [{ file: '/filea', ext: '.ts', hash: 'some-hash' }],
            },
          },
          child: {
            name: 'child',
            type: 'lib',
            data: {
              files: [{ file: '/fileb', ext: '.ts', hash: 'some-hash' }],
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

    const hash = (
      await hasher.hashTasks([
        {
          target: { project: 'parent', target: 'build' },
          id: 'parent-build',
          overrides: { prop: 'prop-value' },
        },
      ])
    )[0];

    // note that the parent hash is based on parent source files only!
    expect(hash.details.sources).toEqual({
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
            data: {
              files: [{ file: '/filea', ext: '.ts', hash: 'some-hash' }],
            },
          },
          projb: {
            name: 'projb',
            type: 'lib',
            data: {
              files: [{ file: '/fileb', ext: '.ts', hash: 'some-hash' }],
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

    const hasha = (
      await hasher.hashTasks([
        {
          target: { project: 'proja', target: 'build' },
          id: 'proja-build',
          overrides: { prop: 'prop-value' },
        },
      ])
    )[0];

    expect(hasha.value).toContain('yarn.lock.hash'); //implicits
    expect(hasha.value).toContain('a.hash'); //project files
    expect(hasha.value).toContain('b.hash'); //project files
    expect(hasha.value).toContain('prop-value'); //overrides
    expect(hasha.value).toContain('proj'); //project
    expect(hasha.value).toContain('build'); //target
    expect(hasha.details.sources).toEqual({ proja: 'a.hash', projb: 'b.hash' });

    const hashb = (
      await hasher.hashTasks([
        {
          target: { project: 'projb', target: 'build' },
          id: 'projb-build',
          overrides: { prop: 'prop-value' },
        },
      ])
    )[0];

    expect(hashb.value).toContain('yarn.lock.hash'); //implicits
    expect(hashb.value).toContain('a.hash'); //project files
    expect(hashb.value).toContain('b.hash'); //project files
    expect(hashb.value).toContain('prop-value'); //overrides
    expect(hashb.value).toContain('proj'); //project
    expect(hashb.value).toContain('build'); //target
    expect(hashb.details.sources).toEqual({ proja: 'a.hash', projb: 'b.hash' });

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
