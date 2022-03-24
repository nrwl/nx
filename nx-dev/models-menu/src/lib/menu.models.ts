import { DocumentMetadata } from '@nrwl/nx-dev/models-document';

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
  itemList?: MenuItem[];
  disableCollapsible?: boolean;
}
