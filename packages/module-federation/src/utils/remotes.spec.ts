import { mapRemotes } from './remotes';
import { isAbsoluteUrl, processRemoteLocation } from './url-helpers';

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

  describe('scoped names support', () => {
    it('should map string remotes using aliases for scoped names', () => {
      expect(
        mapRemotes(
          ['@nx-mf/remote'],
          'js',
          (remote) => {
            return `http://localhost:3001/remoteEntry.js`;
          },
          true
        )
      ).toEqual({
        '@nx-mf/remote': '_nx_mf_remote@http://localhost:3001/remoteEntry.js',
      });
    });

    it('should map array remotes using aliases for scoped names', () => {
      expect(
        mapRemotes(
          [['@nx-mf/remote', 'http://localhost:4201/remoteEntry.js']],
          'js',
          (remote) => remote,
          true
        )
      ).toEqual({
        '@nx-mf/remote': '_nx_mf_remote@http://localhost:4201/remoteEntry.js',
      });
    });
    it('should map array remotes using aliases for scoped names', () => {
      expect(
        mapRemotes(
          [['@nx-mf/remote', 'http://localhost:4201/remoteEntry.js']],
          'js',
          (remote) => remote,
          true
        )
      ).toEqual({
        '@nx-mf/remote': '_nx_mf_remote@http://localhost:4201/remoteEntry.js',
      });
    });
  });

  describe('relative URL support', () => {
    it('should handle relative URLs without remoteEntry', () => {
      expect(
        mapRemotes([['remote1', 'remote/path']], 'js', (remote) => remote, true)
      ).toEqual({
        remote1: 'remote1@remote/path/remoteEntry.js',
      });
    });

    it('should handle relative URLs with remoteEntry', () => {
      expect(
        mapRemotes(
          [['remote1', 'remote/remoteEntry.js']],
          'js',
          (remote) => remote,
          true
        )
      ).toEqual({
        remote1: 'remote1@remote/remoteEntry.js',
      });
    });

    it('should handle relative URLs with subdirectories', () => {
      expect(
        mapRemotes(
          [['remote1', 'apps/remote/path']],
          'js',
          (remote) => remote,
          true
        )
      ).toEqual({
        remote1: 'remote1@apps/remote/path/remoteEntry.js',
      });
    });

    it('should handle relative URLs with trailing slash', () => {
      expect(
        mapRemotes(
          [['remote1', 'remote/path/']],
          'js',
          (remote) => remote,
          true
        )
      ).toEqual({
        remote1: 'remote1@remote/path/remoteEntry.js',
      });
    });

    it('should handle mixed relative and absolute URLs', () => {
      expect(
        mapRemotes(
          [
            ['remote1', 'remote/path'],
            ['remote2', 'http://localhost:4201/remoteEntry.js'],
          ],
          'js',
          (remote) => remote,
          true
        )
      ).toEqual({
        remote1: 'remote1@remote/path/remoteEntry.js',
        remote2: 'remote2@http://localhost:4201/remoteEntry.js',
      });
    });

    it('should preserve absolute URLs with query parameters', () => {
      expect(
        mapRemotes(
          [['remote1', 'http://localhost:4201?version=1.0.0']],
          'js',
          (remote) => remote,
          true
        )
      ).toEqual({
        remote1: 'remote1@http://localhost:4201/remoteEntry.js?version=1.0.0',
      });
    });

    it('should preserve absolute URLs with hash fragments', () => {
      expect(
        mapRemotes(
          [['remote1', 'http://localhost:4201#main']],
          'js',
          (remote) => remote,
          true
        )
      ).toEqual({
        remote1: 'remote1@http://localhost:4201/remoteEntry.js#main',
      });
    });

    it('should handle promise-based remotes correctly', () => {
      const promiseCode = `promise new Promise(resolve => {
        const remoteUrl = 'http://localhost:4201/remoteEntry.js';
        const script = document.createElement('script');
        script.src = remoteUrl;
        script.onload = () => {
          const proxy = {
            get: (request) => window.remote1.get(request),
            init: (arg) => {
              try {
                window.remote1.init(arg);
              } catch (e) {
                console.log('Remote container already initialized');
              }
            }
          };
          resolve(proxy);
        }
        document.head.appendChild(script);
      })`;

      expect(
        mapRemotes([['remote1', promiseCode]], 'js', (remote) => remote, true)
      ).toEqual({
        remote1: promiseCode,
      });
    });
  });
});

describe('URL Helper Functions', () => {
  describe('isAbsoluteUrl', () => {
    it('should return true for absolute URLs', () => {
      expect(isAbsoluteUrl('http://localhost:4201')).toBe(true);
      expect(isAbsoluteUrl('https://example.com')).toBe(true);
      expect(isAbsoluteUrl('ftp://example.com')).toBe(true);
    });

    it('should return false for relative URLs', () => {
      expect(isAbsoluteUrl('remote/path')).toBe(false);
      expect(isAbsoluteUrl('./remote/path')).toBe(false);
      expect(isAbsoluteUrl('../remote/path')).toBe(false);
      expect(isAbsoluteUrl('/remote/path')).toBe(false);
    });
  });

  describe('processRemoteLocation', () => {
    it('should handle promise-based remotes as-is', () => {
      const promiseRemote =
        'promise new Promise((resolve) => { resolve("test"); })';
      expect(processRemoteLocation(promiseRemote, 'js')).toBe(promiseRemote);
    });

    it('should add remoteEntry to relative URLs without extension', () => {
      expect(processRemoteLocation('remote/path', 'js')).toBe(
        'remote/path/remoteEntry.js'
      );
      expect(processRemoteLocation('remote/path', 'mjs')).toBe(
        'remote/path/remoteEntry.mjs'
      );
    });

    it('should preserve relative URLs with valid extensions', () => {
      expect(processRemoteLocation('remote/remoteEntry.js', 'js')).toBe(
        'remote/remoteEntry.js'
      );
      expect(processRemoteLocation('remote/manifest.json', 'js')).toBe(
        'remote/manifest.json'
      );
    });

    it('should handle relative URLs with trailing slash', () => {
      expect(processRemoteLocation('remote/path/', 'js')).toBe(
        'remote/path/remoteEntry.js'
      );
    });

    it('should add remoteEntry to absolute URLs without extension', () => {
      expect(processRemoteLocation('http://localhost:4201', 'js')).toBe(
        'http://localhost:4201/remoteEntry.js'
      );
    });

    it('should preserve absolute URLs with valid extensions', () => {
      expect(
        processRemoteLocation('http://localhost:4201/remoteEntry.js', 'js')
      ).toBe('http://localhost:4201/remoteEntry.js');
    });

    it('should preserve query parameters and hash fragments for absolute URLs', () => {
      expect(
        processRemoteLocation('http://localhost:4201?v=1.0#main', 'js')
      ).toBe('http://localhost:4201/remoteEntry.js?v=1.0#main');
    });
  });
});
