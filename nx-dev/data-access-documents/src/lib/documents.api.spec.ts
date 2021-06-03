import { DocumentsApi } from './documents.api';
import type { DocumentMetadata } from './documents.models';
import { join } from 'path';
import fs from 'fs';

const archiveRootPath = join(
  process.env.WORKSPACE_ROOT,
  'nx-dev/nx-dev/public/documentation'
);
const documentsCache = new Map<string, DocumentMetadata[]>([
  ['latest', readJsonFile(join(archiveRootPath, 'latest', 'map.json'))],
  ['previous', readJsonFile(join(archiveRootPath, 'previous', 'map.json'))],
]);
const versionsData = readJsonFile(join(archiveRootPath, 'versions.json'));

function readJsonFile(f) {
  return JSON.parse(fs.readFileSync(f).toString());
}

describe('DocumentsApi', () => {
  const api = new DocumentsApi(versionsData, documentsCache);

  describe('getDocument', () => {
    it('should retrieve documents that exist', () => {
      const result = api.getDocument('latest', 'react', [
        'getting-started',
        'getting-started',
      ]);

      expect(result.filePath).toBeTruthy();
    });

    it('should throw error if segments do not match a file', () => {
      expect(() =>
        api.getDocument('latest', 'vue', ['does', 'not', 'exist'])
      ).toThrow();
    });
  });

  describe('getDocumentsPath', () => {
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
});
