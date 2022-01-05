import type { DocumentsApi } from './documents.api';
import { Menu } from './menu.models';
import {
  createMenuItems,
  getApiSection,
  getBasicSection,
  getDeepDiveSection,
} from './menu.utils';

export class MenuApi {
  private menuCache: Menu | null = null;

  constructor(private readonly documentsApi: DocumentsApi) {}

  getMenu(): Menu {
    let menu = this.menuCache;

    if (!menu) {
      const items = createMenuItems(this.documentsApi.getDocuments());
      if (items) {
        menu = {
          sections: [
            getBasicSection(items),
            getDeepDiveSection(items),
            getApiSection(items),
          ],
        };
      } else {
        throw new Error(`Cannot find any documents`);
      }
      this.menuCache = menu;
    }

    return menu;
  }
}
