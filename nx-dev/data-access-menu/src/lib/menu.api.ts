import { MenuItem } from '@nrwl/nx-dev/models-menu';

export class MenusApi {
  private readonly cache: { id: string; menu: MenuItem[] }[];
  constructor(private readonly menus: { id: string; menu: MenuItem[] }[]) {
    if (!menus) {
      throw new Error('tags property cannot be undefined');
    }

    this.cache = [...this.menus];
  }

  getMenu(id: string, prefix: string = ''): MenuItem[] {
    const target: { id: string; menu: MenuItem[] } | null =
      this.cache.find((menu) => menu.id === id) || null;

    if (!target) throw new Error(`No associated items found for tag: "${id}"`);

    function applyPrefix(menu: MenuItem, prefix: string): MenuItem {
      if (menu.children.length)
        menu.children = menu.children.map((m) => applyPrefix(m, prefix));

      // We want to add prefix to the item's path only if it is a standard item.
      if (
        !menu.isExternal &&
        !menu.path.startsWith('/') &&
        !!prefix &&
        !menu.path.startsWith(prefix)
      )
        menu.path = `/${prefix}/`.concat(menu.path);

      return menu;
    }

    return target.menu.map((m) => applyPrefix(m, prefix));
  }
}
