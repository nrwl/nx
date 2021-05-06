import { getDocuments } from '@nrwl/nx-dev/data-access-documents';
import { Menu } from './menu.models';
import {
  createMenuItems,
  getApiSection,
  getBasicSection,
  getDeepDiveSection,
} from './menu.utils';

const menuCache = new Map<string, Menu>();
export function getMenu(version: string, flavor: string): Menu {
  const key = `${version}-${flavor}`;
  let menu = menuCache.get(key);

  if (!menu) {
    const root = getDocuments(version);
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
    menuCache.set(key, menu);
  }

  return menu;
}
