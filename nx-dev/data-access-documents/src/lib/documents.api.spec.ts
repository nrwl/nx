import {
  getArchivedVersions,
  getDocument,
  getDocuments,
  getStaticDocumentPaths,
} from './documents.api';

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

describe('getArchivedVersions', () => {
  it('should return versions data', () => {
    expect(getArchivedVersions()).toEqual([
      expect.objectContaining({ id: 'latest' }),
      expect.objectContaining({ id: 'previous' }),
    ]);
  });
});

describe('getDocuments', () => {
  it.each`
    version
    ${'preview'}
    ${'latest'}
    ${'previous'}
  `('should return a list of documents', ({ version }) => {
    expect(getDocuments(version)).toEqual(expect.any(Array));
  });
});

describe('getStaticDocumentPaths', () => {
  it.each`
    version
    ${'preview'}
    ${'latest'}
    ${'previous'}
  `('should return a list of document paths', ({ version }) => {
    expect(getStaticDocumentPaths(version)).toEqual(expect.any(Array));
  });
});
