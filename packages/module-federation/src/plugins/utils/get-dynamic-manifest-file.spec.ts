jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn((...args: any[]) =>
    (jest.requireActual('fs') as any).existsSync(...args)
  ),
}));
const fs = require('fs');

import { getDynamicMfManifestFile } from './get-dynamic-manifest-file';

describe('getDynamicMfManifestFile', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return the correct manifest file', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const manifestFile = getDynamicMfManifestFile(
      { root: 'myapp', sourceRoot: 'myapp/src' },
      'my-workspace'
    );

    expect(manifestFile).toEqual(
      'my-workspace/myapp/public/module-federation.manifest.json'
    );
  });

  it('should return undefined if the manifest file does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const manifestFile = getDynamicMfManifestFile(
      { root: 'myapp', sourceRoot: 'myapp/src' },
      'my-workspace'
    );

    expect(manifestFile).toBeUndefined();
  });
});
