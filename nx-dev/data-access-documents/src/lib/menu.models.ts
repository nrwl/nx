import { DocumentMetadata } from './documents.models';

export interface Menu {
  version: string;
  flavor: string;
  sections: MenuSection[];
}

export interface MenuSection {
  id: string;
  name: string;
  itemList: MenuItem[];
  hideSectionHeader?: boolean;
}

export interface MenuItem extends DocumentMetadata {
  path?: string;
  itemList?: MenuItem[];
  disableCollapsible?: boolean;
}
