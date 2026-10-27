import * as path from 'path';
import * as fileUtils from './fileutils';
import * as ownedPrivateDir from './owned-private-dir';
import { isTrustedWorkspaceEntry, workspaceRootInner } from './workspace-root';

const rootMarkers = ['nx.json', 'nx', 'nx.bat'];

describe('workspaceRootInner', () => {
  // The paths exist only for the `fileExists` stub, so ownership is stubbed
  // too: everything outside `/tmp` belongs to us, as on a real machine.
  beforeEach(() => {
    vi.spyOn(ownedPrivateDir, 'isTrustedAncestorEntry').mockImplementation(
      (dir) => dir !== '/tmp'
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it.each(rootMarkers)(
    'should walk past a %s another user owns in a world-writable ancestor',
    (marker) => {
      vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
        [`/tmp/${marker}`, '/tmp/node_modules/nx/package.json'].includes(
          p.toString()
        )
      );

      expect(workspaceRootInner('/tmp/project', null)).toBeNull();
      expect(ownedPrivateDir.isTrustedAncestorEntry).toHaveBeenCalledWith(
        '/tmp',
        marker
      );
      expect(ownedPrivateDir.isTrustedAncestorEntry).toHaveBeenCalledWith(
        '/tmp',
        'node_modules'
      );
    }
  );

  it('should not let a refused ancestor marker outrank a workspace install', () => {
    vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
      ['/tmp/nx.json', '/tmp/ws/node_modules/nx/package.json'].includes(
        p.toString()
      )
    );

    expect(workspaceRootInner('/tmp/ws/packages/a', null)).toEqual('/tmp/ws');
  });

  it('should find our own workspace below a world-writable ancestor', () => {
    vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
      ['/tmp/nx.json', '/tmp/ws/nx.json'].includes(p.toString())
    );

    expect(workspaceRootInner('/tmp/ws/packages/a', null)).toEqual('/tmp/ws');
  });

  it.each(rootMarkers)('should find workspace root from %s', (marker) => {
    vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
      [
        `/home/workspace/${marker}`,
        '/home/workspace/packages/a/package.json',
        '/home/workspace/packages/b/package.json',
        '/home/workspace/packages/c/package.json',
      ].includes(p.toString())
    );

    expect(workspaceRootInner('/home/workspace', null)).toEqual(
      '/home/workspace'
    );
  });

  it.each(rootMarkers)(
    'should find workspace root from %s when in subpackage',
    (marker) => {
      vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
        [
          `/home/workspace/${marker}`,
          '/home/workspace/packages/a/package.json',
          '/home/workspace/packages/b/package.json',
          '/home/workspace/packages/c/package.json',
        ].includes(p.toString())
      );

      expect(workspaceRootInner('/home/workspace/packages/a', null)).toEqual(
        '/home/workspace'
      );
    }
  );

  it.each(rootMarkers)(
    'should prefer workspace root from %s when in subpackage containing nx',
    (marker) => {
      vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
        [
          `/home/workspace/${marker}`,
          '/home/workspace/packages/a/node_modules/nx/package.json',
          '/home/workspace/packages/a/package.json',
          '/home/workspace/packages/b/package.json',
          '/home/workspace/packages/c/package.json',
        ].includes(p.toString())
      );

      expect(workspaceRootInner('/home/workspace/packages/a', null)).toEqual(
        '/home/workspace'
      );
    }
  );

  it('should find workspace root from installation when marker not present', () => {
    vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
      [
        `/home/workspace/node_modules/nx/package.json`,
        '/home/workspace/packages/a/package.json',
        '/home/workspace/packages/b/package.json',
        '/home/workspace/packages/c/package.json',
      ].includes(p.toString())
    );

    expect(workspaceRootInner('/home/workspace/packages/a', null)).toEqual(
      '/home/workspace'
    );
  });

  it('should prefer outer workspace root from installation when marker not present and nested', () => {
    vi.spyOn(fileUtils, 'fileExists').mockImplementation((p) =>
      [
        `/home/workspace/node_modules/nx/package.json`,
        '/home/workspace/packages/a/node_modules/nx/package.json',
        '/home/workspace/packages/a/package.json',
        '/home/workspace/packages/b/package.json',
        '/home/workspace/packages/c/package.json',
      ].includes(p.toString())
    );

    expect(workspaceRootInner('/home/workspace/packages/a', null)).toEqual(
      '/home/workspace'
    );
  });
});

describe('isTrustedWorkspaceEntry', () => {
  const original = process.env.NX_WORKSPACE_ROOT_PATH;

  beforeEach(() => {
    vi.spyOn(ownedPrivateDir, 'isTrustedAncestorEntry').mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (original === undefined) delete process.env.NX_WORKSPACE_ROOT_PATH;
    else process.env.NX_WORKSPACE_ROOT_PATH = original;
  });

  it('should say which entry it refused and how to use it anyway', () => {
    expect(isTrustedWorkspaceEntry('/tmp/shared', 'nx.json')).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(path.join('/tmp/shared', 'nx.json'))
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('NX_WORKSPACE_ROOT_PATH=/tmp/shared')
    );
  });

  it('should trust entries of the root named by NX_WORKSPACE_ROOT_PATH', () => {
    process.env.NX_WORKSPACE_ROOT_PATH = '/tmp/shared';

    expect(isTrustedWorkspaceEntry('/tmp/shared', 'node_modules')).toBe(true);
    expect(isTrustedWorkspaceEntry('/tmp', 'node_modules')).toBe(false);
  });
});
