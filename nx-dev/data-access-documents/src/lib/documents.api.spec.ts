import { getDocument, getDocumentsRoot, getVersions } from './documents.api';

describe('getDocument', () => {
  it('should retrieve documents that exist', () => {
    const result = getDocument('latest', [
      'react',
      'getting-started',
      'getting-started',
    ]);

    expect(result.filePath).toBeTruthy();
  });

  it('should throw error if segments do not match a file', () => {
    expect(() =>
      getDocument('latest', ['this', 'does', 'not', 'exist'])
    ).toThrow();
  });
});

describe('getDocumentsPath', () => {
  it('should support preview', () => {
    expect(getDocumentsRoot('preview')).toMatch('docs');
  });

  it('should support latest', () => {
    expect(getDocumentsRoot('latest')).toMatch(
      /nx-dev\/nx-dev\/public\/documentation\/\d+\.\d+\.\d+/
    );
  });

  it('should support previous', () => {
    expect(getDocumentsRoot('previous')).toMatch(
      /nx-dev\/nx-dev\/public\/documentation\/\d+\.\d+\.\d+/
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
