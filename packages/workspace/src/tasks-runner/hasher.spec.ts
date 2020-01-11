import { Hasher } from './hasher';
const hasha = require('hasha');
const fs = require('fs');
jest.mock('hasha');
jest.mock('fs');

describe('Hasher', () => {
  let hashes = { 'yarn.lock': 'yarn.lock.hash' };
  beforeEach(() => {
    hasha.mockImplementation(values => values.join('|'));
    hasha.fromFile.mockImplementation(path => Promise.resolve(hashes[path]));
    fs.statSync.mockReturnValue({ size: 100 });
  });

  it('should create project hash', async done => {
    hashes['/file'] = 'file.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proj: {
            name: 'proj',
            type: 'lib',
            data: { files: [{ file: '/file', ext: '.ts', mtime: 1 }] }
          }
        },
        dependencies: {
          proj: []
        }
      },
      {} as any
    );

    const hash = await hasher.hash({
      target: { project: 'proj', target: 'build' },
      id: 'proj-build',
      overrides: { prop: 'prop-value' }
    });

    expect(hash).toContain('yarn.lock.hash'); //implicits
    expect(hash).toContain('file.hash'); //project files
    expect(hash).toContain('prop-value'); //overrides
    expect(hash).toContain('proj'); //project
    expect(hash).toContain('build'); //target

    done();
  });

  it('should hash when circular dependencies', async done => {
    hashes['/filea'] = 'a.hash';
    hashes['/fileb'] = 'b.hash';
    const hasher = new Hasher(
      {
        nodes: {
          proja: {
            name: 'proja',
            type: 'lib',
            data: { files: [{ file: '/filea', ext: '.ts', mtime: 1 }] }
          },
          projb: {
            name: 'projb',
            type: 'lib',
            data: { files: [{ file: '/fileb', ext: '.ts', mtime: 1 }] }
          }
        },
        dependencies: {
          proja: [{ source: 'proja', target: 'projb', type: 'static' }],
          projb: [{ source: 'projb', target: 'proja', type: 'static' }]
        }
      },
      {} as any
    );

    const hasha = await hasher.hash({
      target: { project: 'proja', target: 'build' },
      id: 'proja-build',
      overrides: { prop: 'prop-value' }
    });

    expect(hasha).toContain('yarn.lock.hash'); //implicits
    expect(hasha).toContain('a.hash'); //project files
    expect(hasha).toContain('b.hash'); //project files
    expect(hasha).toContain('prop-value'); //overrides
    expect(hasha).toContain('proj'); //project
    expect(hasha).toContain('build'); //target

    const hashb = await hasher.hash({
      target: { project: 'projb', target: 'build' },
      id: 'projb-build',
      overrides: { prop: 'prop-value' }
    });

    expect(hashb).toContain('yarn.lock.hash'); //implicits
    expect(hashb).toContain('a.hash'); //project files
    expect(hashb).toContain('b.hash'); //project files
    expect(hashb).toContain('prop-value'); //overrides
    expect(hashb).toContain('proj'); //project
    expect(hashb).toContain('build'); //target

    done();
  });

  it('should handle large binary files in a special way', async done => {
    fs.statSync.mockImplementation(f => {
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
            data: { files: [{ file: '/file', ext: '.ts', mtime: 1 }] }
          }
        },
        dependencies: {}
      },
      {} as any
    );

    const hash = await hasher.hash({
      target: { project: 'proja', target: 'build' },
      id: 'proja-build',
      overrides: { prop: 'prop-value' }
    });

    expect(hash).toContain('yarn.lock.hash'); //implicits
    expect(hash).toContain('5000001'); //project files
    expect(hash).toContain('prop-value'); //overrides
    expect(hash).toContain('proj'); //project
    expect(hash).toContain('build'); //target

    done();
  });
});
