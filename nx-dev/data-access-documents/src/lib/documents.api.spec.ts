import { DocumentsApi } from './documents.api';
import { createDocumentApiOptions } from './test-utils';

describe('DocumentsApi', () => {
  const api = new DocumentsApi(createDocumentApiOptions());

  describe('getDocument', () => {
    it('should retrieve documents that exist', () => {
      const result = api.getDocument(['getting-started', 'intro']);

      expect(result.filePath).toBeTruthy();
    });

    it('should throw error if segments do not match a file', () => {
      expect(() => api.getDocument(['does', 'not', 'exist'])).toThrow();
    });
  });

  // describe('getStaticDocumentPaths', () => {
  //   const paths = api.getStaticDocumentPaths();
  //   const urls = paths.map((p) => p.params.segments.join('/'));
  //
  //   it('should return paths', () =>
  //     expect(urls).toContainEqual(expect.stringMatching('/getting-started')));
  // });
});
