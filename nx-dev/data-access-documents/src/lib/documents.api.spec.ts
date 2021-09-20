import { DocumentsApi } from './documents.api';
import { createDocumentApiOptions } from './test-utils';

describe('DocumentsApi', () => {
  const api = new DocumentsApi(createDocumentApiOptions());

  describe('getDocument', () => {
    it('should retrieve documents that exist', () => {
      const result = api.getDocument(
        api.getDefaultVersion(),
        api.getDefaultFlavor(),
        ['getting-started', 'intro']
      );

      expect(result.filePath).toBeTruthy();
    });

    it('should throw error if segments do not match a file', () => {
      expect(() =>
        api.getDocument(
          api.getDefaultVersion(),
          { id: 'vue', alias: 'v', name: 'Vue', path: 'does not exist' },
          ['does', 'not', 'exist']
        )
      ).toThrow();
    });
  });

  describe('getDocumentsRoot', () => {
    it('should support latest', () => {
      expect(api.getDocumentsRoot('latest')).toMatch(
        /nx-dev\/nx-dev\/public\/documentation\/latest/
      );
    });

    it('should support previous', () => {
      expect(api.getDocumentsRoot('previous')).toMatch(
        /nx-dev\/nx-dev\/public\/documentation\/previous/
      );
    });
  });

  describe('getVersions', () => {
    it('should return versions data', () => {
      expect(api.getVersions()).toEqual([
        expect.objectContaining({ id: 'latest' }),
        expect.objectContaining({ id: 'previous' }),
      ]);
    });
  });

  describe('getFlavors', () => {
    it('should return versions data', () => {
      expect(api.getFlavors()).toEqual([
        expect.objectContaining({ id: 'angular' }),
        expect.objectContaining({ id: 'react' }),
        expect.objectContaining({ id: 'node' }),
      ]);
    });
  });

  describe('getStaticDocumentPaths', () => {
    const paths = api
      .getVersions()
      .flatMap((v) =>
        api.getFlavors().flatMap((f) => api.getStaticDocumentPaths(v, f))
      );
    const urls = paths.map((p) => p.params.segments.join('/'));

    it.each`
      version | flavor
      ${'l'}  | ${'r'}
      ${'l'}  | ${'a'}
      ${'l'}  | ${'n'}
      ${'p'}  | ${'r'}
      ${'p'}  | ${'a'}
      ${'p'}  | ${'n'}
    `('should return paths for all flavors', ({ version, flavor }) =>
      expect(urls).toContainEqual(
        expect.stringMatching(`${version}/${flavor}/getting-started`)
      )
    );

    it('should return generic paths for the latest version', () =>
      expect(urls).toContainEqual(expect.stringMatching(/^getting-started\//)));
  });
});
