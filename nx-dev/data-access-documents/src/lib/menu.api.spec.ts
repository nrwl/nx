import { MenuApi } from './menu.api';
import { DocumentsApi } from '@nrwl/nx-dev/data-access-documents';
import { createDocumentApiOptions } from './test-utils';

describe('MenuApi', () => {
  const docsApi = new DocumentsApi(createDocumentApiOptions());
  const api = new MenuApi(docsApi);

  describe('getMenu', () => {
    it('should group by section', () => {
      const menu = api.getMenu();

      expect(menu).toEqual({
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
  });
});
