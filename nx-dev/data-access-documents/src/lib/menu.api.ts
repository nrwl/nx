import type { DocumentsApi } from './documents.api';
import { Menu } from './menu.models';
import {
  createMenuItems,
  getApiSection,
  getBasicSection,
  getDeepDiveSection,
} from './menu.utils';

export class MenuApi {
  private readonly menuCache = new Map<string, Menu>();

  constructor(private readonly documentsApi: DocumentsApi) {}

  getMenu(version: string, flavor: string): Menu {
    const key = `${version}-${flavor}`;
    let menu = this.menuCache.get(key);

    if (!menu) {
      const root = this.documentsApi.getDocuments(version);
      const items = createMenuItems(version, flavor, root);
      if (items) {
        menu = {
          version,
          flavor,
          sections: [
            getBasicSection(items),
            getDeepDiveSection(items),
            getApiSection(items),
          ],
        };
      } else {
        throw new Error(`Cannot find documents for flavor "${flavor}"`);
      }
      this.menuCache.set(key, menu);
    }

    return menu;
  }
}
