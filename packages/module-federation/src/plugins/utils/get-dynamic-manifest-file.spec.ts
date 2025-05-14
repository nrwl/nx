import * as fs from 'fs';
import { getDynamicMfManifestFile } from './get-dynamic-manifest-file';

describe('getDynamicMfManifestFile', () => {
  it('should return the correct manifest file', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const manifestFile = getDynamicMfManifestFile(
      { root: 'myapp', sourceRoot: 'myapp/src' },
      'my-workspace'
    );

    expect(manifestFile).toEqual(
      'my-workspace/myapp/public/module-federation.manifest.json'
    );
  });

  it('should return undefined if the manifest file does not exist', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const manifestFile = getDynamicMfManifestFile(
      { root: 'myapp', sourceRoot: 'myapp/src' },
      'my-workspace'
    );

    expect(manifestFile).toBeUndefined();
  });
});
