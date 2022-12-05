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
  id: string;
  isExternal: boolean;
  children: MenuItem[];
  disableCollapsible: boolean;
}
