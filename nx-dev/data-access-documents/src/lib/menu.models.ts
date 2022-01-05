import { DocumentMetadata, VersionMetadata } from './documents.models';

export interface Menu {
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
  url?: string;
  itemList?: MenuItem[];
  disableCollapsible?: boolean;
}
