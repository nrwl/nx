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

  getMenu(
    version: { alias: string; value: string },
    flavor: { alias: string; value: string }
  ): Menu {
    const key = `${version.value}-${flavor.alias}`;
    let menu = this.menuCache.get(key);

    if (!menu) {
      const root = this.documentsApi.getDocuments(version.value);
      const items = createMenuItems(version.alias, flavor, root);

      if (items) {
        menu = {
          version: version.value,
          flavor: flavor.value,
          sections: [
            getBasicSection(items),
            getDeepDiveSection(items),
            getApiSection(items),
          ],
        };
      } else {
        throw new Error(`Cannot find documents for flavor "${flavor.alias}"`);
      }
      this.menuCache.set(key, menu);
    }

    return menu;
  }
}
