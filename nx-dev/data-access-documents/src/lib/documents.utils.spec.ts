import { getDocumentsRoot, getVersions } from './documents.utils';

describe('getDocumentsPath', () => {
  it('should support preview', () => {
    expect(getDocumentsRoot('preview')).toMatch('docs');
  });

  it('should support latest', () => {
    expect(getDocumentsRoot('latest')).toMatch(
      /data-access-documents\/src\/data\/\d+\.\d+\.\d+/
    );
  });

  it('should support previous', () => {
    expect(getDocumentsRoot('previous')).toMatch(
      /data-access-documents\/src\/data\/\d+\.\d+\.\d+/
    );
  });
});

describe('getVersions', () => {
  it('should return versions data', () => {
    expect(getVersions()).toEqual([
      expect.objectContaining({ id: 'latest' }),
      expect.objectContaining({ id: 'previous' }),
    ]);
  });
});
