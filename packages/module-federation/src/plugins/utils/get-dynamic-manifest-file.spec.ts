let existsSyncMock = jest.fn();
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: existsSyncMock,
}));
import * as fs from 'fs';
import { getDynamicMfManifestFile } from './get-dynamic-manifest-file';

describe('getDynamicMfManifestFile', () => {
  afterAll(() => {
    existsSyncMock.mockRestore();
    jest.restoreAllMocks();
  });

  it('should return the correct manifest file', () => {
    existsSyncMock.mockReturnValue(true);

    const manifestFile = getDynamicMfManifestFile(
      { root: 'myapp', sourceRoot: 'myapp/src' },
      'my-workspace'
    );

    expect(manifestFile).toEqual(
      'my-workspace/myapp/public/module-federation.manifest.json'
    );
  });

  it('should return undefined if the manifest file does not exist', () => {
    existsSyncMock.mockReturnValue(false);

    const manifestFile = getDynamicMfManifestFile(
      { root: 'myapp', sourceRoot: 'myapp/src' },
      'my-workspace'
    );

    expect(manifestFile).toBeUndefined();
  });
});
