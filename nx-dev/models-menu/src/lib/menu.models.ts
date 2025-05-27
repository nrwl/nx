export interface Menu {
  sections: MenuSection[];
}

export interface MenuSection {
  id: string;
  name: string;
  itemList: MenuItem[];
  hideSectionHeader: boolean;
}

export interface MenuItem {
  name: string;
  path: string;
  // Moved API docs under /technologies
  // The old path can be removed once we have redirects set up
  newPath?: string;
  id: string;
  isExternal: boolean;
  children: MenuItem[];
  disableCollapsible: boolean;
}
