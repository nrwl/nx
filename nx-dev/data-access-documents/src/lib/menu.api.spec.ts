import { MenuApi } from './menu.api';
import {
  DocumentMetadata,
  DocumentsApi,
} from '@nrwl/nx-dev/data-access-documents';
import { join } from 'path';
import * as fs from 'fs';

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

describe('MenuApi', () => {
  const docsApi = new DocumentsApi(versionsData, documentsCache);
  const api = new MenuApi(docsApi);

  describe('getMenu', () => {
    it('should group by section', () => {
      const menu = api.getMenu('latest', 'react');

      expect(menu).toEqual({
        version: 'latest',
        flavor: 'react',
        sections: expect.arrayContaining([
          expect.objectContaining({ id: 'basic', itemList: expect.any(Array) }),
          expect.objectContaining({ id: 'api', itemList: expect.any(Array) }),
          expect.objectContaining({
            id: 'deep-dive',
            itemList: expect.any(Array),
          }),
        ]),
      });
    });

    it('should add path to menu items', () => {
      const menu = api.getMenu('latest', 'react');

      // first basic section item should have prefix by version and flavor
      // e.g. "latest/react/getting-started/intro"
      expect(menu.sections[0].itemList[0].itemList[0].path).toMatch(
        /latest\/react/
      );
    });
  });
});
