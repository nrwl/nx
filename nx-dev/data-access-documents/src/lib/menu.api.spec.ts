import { MenuApi } from './menu.api';
import { DocumentsApi } from '@nrwl/nx-dev/data-access-documents';
import { createDocumentApiOptions } from './test-utils';

describe('MenuApi', () => {
  const docsApi = new DocumentsApi(createDocumentApiOptions());
  const api = new MenuApi(docsApi);

  describe('getMenu', () => {
    it('should group by section', () => {
      const menu = api.getMenu(
        docsApi.getDefaultVersion(),
        docsApi.getDefaultFlavor()
      );

      expect(menu).toEqual({
        version: docsApi.getDefaultVersion(),
        flavor: docsApi.getDefaultFlavor(),
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
      const menu = api.getMenu(
        docsApi.getDefaultVersion(),
        docsApi.getDefaultFlavor()
      );

      // first basic section item should have prefix by version and flavor
      // e.g. "latest/react/getting-started/intro"
      expect(menu?.sections?.[0]?.itemList?.[0]?.itemList?.[0].url).toMatch(
        /l\/r/
      );
      expect(menu?.sections?.[0]?.itemList?.[0]?.itemList?.[0].path).toMatch(
        /latest\/react/
      );
    });
  });
});
