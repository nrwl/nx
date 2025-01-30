import { mapRemotes } from './remotes';

describe('mapRemotes', () => {
  it('should map string remotes', () => {
    expect(
      mapRemotes(
        ['remote1', 'remote2', 'remote3'],
        'js',
        (remote) => {
          return `http://localhost:300${remote.at(-1)}/remoteEntry.js`;
        },
        true
      )
    ).toEqual({
      remote1: 'remote1@http://localhost:3001/remoteEntry.js',
      remote2: 'remote2@http://localhost:3002/remoteEntry.js',
      remote3: 'remote3@http://localhost:3003/remoteEntry.js',
    });
  });

  it('should map array remotes', () => {
    expect(
      mapRemotes(
        [
          ['remote1', 'http://localhost:4201'],
          ['remote2', 'http://localhost:4202'],
          ['remote3', 'http://localhost:4203'],
        ],
        'js',
        (remote) => remote,
        true
      )
    ).toEqual({
      remote1: 'remote1@http://localhost:4201/remoteEntry.js',
      remote2: 'remote2@http://localhost:4202/remoteEntry.js',
      remote3: 'remote3@http://localhost:4203/remoteEntry.js',
    });
  });

  it('should map array remotes with path to remoteEntry', () => {
    expect(
      mapRemotes(
        [
          ['remote1', 'http://localhost:4201/remoteEntry.js'],
          ['remote2', 'http://localhost:4202/remoteEntry.mjs'],
          ['remote3', 'http://localhost:4203/mf-manifest.json'],
        ],
        'js',
        (remote) => remote,
        true
      )
    ).toEqual({
      remote1: 'remote1@http://localhost:4201/remoteEntry.js',
      remote2: 'remote2@http://localhost:4202/remoteEntry.mjs',
      remote3: 'remote3@http://localhost:4203/mf-manifest.json',
    });
  });
});
