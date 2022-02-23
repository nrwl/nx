import { DocumentMetadata } from '@nrwl/nx-dev/models-document';
import { Menu } from '@nrwl/nx-dev/models-menu';
import {
  createMenuItems,
  getApiSection,
  getBasicSection,
  getDeepDiveSection,
} from './menu.utils';

export class MenuApi {
  private menuCache: Menu | null = null;

  constructor(private readonly documents: DocumentMetadata) {}

  getMenu(): Menu {
    let menu = this.menuCache;

    if (!menu) {
      const items = createMenuItems(this.documents);
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
