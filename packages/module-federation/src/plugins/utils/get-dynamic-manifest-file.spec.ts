import type { Mock } from 'vitest';
vi.mock('fs', async () => {
  const actual = await vi.importActual<any>('fs');
  return {
    ...actual,
    existsSync: vi.fn((...args: any[]) => actual.existsSync(...args)),
  };
});
import * as fs from 'fs';

import { getDynamicMfManifestFile } from './get-dynamic-manifest-file';

describe('getDynamicMfManifestFile', () => {
  afterEach(() => vi.clearAllMocks());

  it('should return the correct manifest file', () => {
    (fs.existsSync as Mock).mockReturnValue(true);

    const manifestFile = getDynamicMfManifestFile(
      { root: 'myapp', sourceRoot: 'myapp/src' },
      'my-workspace'
    );

    expect(manifestFile).toEqual(
      'my-workspace/myapp/public/module-federation.manifest.json'
    );
  });

  it('should return undefined if the manifest file does not exist', () => {
    (fs.existsSync as Mock).mockReturnValue(false);

    const manifestFile = getDynamicMfManifestFile(
      { root: 'myapp', sourceRoot: 'myapp/src' },
      'my-workspace'
    );

    expect(manifestFile).toBeUndefined();
  });
});
