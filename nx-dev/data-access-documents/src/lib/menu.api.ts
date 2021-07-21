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

  getMenu(versionId: string, flavorId: string): Menu {
    const key = `${versionId}-${flavorId}`;
    let menu = this.menuCache.get(key);

    if (!menu) {
      const root = this.documentsApi.getDocuments(versionId);
      const items = createMenuItems(versionId, flavorId, root);
      if (items) {
        menu = {
          version: versionId,
          flavor: flavorId,
          sections: [
            getBasicSection(items),
            getDeepDiveSection(items),
            getApiSection(items),
          ],
        };
      } else {
        throw new Error(`Cannot find documents for flavor "${flavorId}"`);
      }
      this.menuCache.set(key, menu);
    }

    return menu;
  }
}
