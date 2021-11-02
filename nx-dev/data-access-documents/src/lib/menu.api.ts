import type { DocumentsApi } from './documents.api';
import { Menu } from './menu.models';
import {
  createMenuItems,
  getApiSection,
  getBasicSection,
  getDeepDiveSection,
} from './menu.utils';
import { FlavorMetadata, VersionMetadata } from './documents.models';

export class MenuApi {
  private readonly menuCache = new Map<string, Menu>();

  constructor(private readonly documentsApi: DocumentsApi) {}

  getMenu(version: VersionMetadata, flavor: FlavorMetadata): Menu {
    const key = `${version.id}-${flavor.id}`;
    let menu = this.menuCache.get(key);

    if (!menu) {
      const root = this.documentsApi.getDocuments(version.id);
      const items = createMenuItems(version, flavor, root);
      if (items) {
        menu = {
          version: version,
          flavor: flavor,
          sections: [
            getBasicSection(items),
            getDeepDiveSection(items),
            getApiSection(items),
          ],
        };
      } else {
        throw new Error(`Cannot find documents for flavor id: "${flavor.id}"`);
      }
      this.menuCache.set(key, menu);
    }

    return menu;
  }
}
