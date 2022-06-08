import { DocumentMetadata } from '@nrwl/nx-dev/models-document';
import { Menu, MenuSection } from '@nrwl/nx-dev/models-menu';
import {
  createMenuItems,
  getBasicSection,
  getDeepDiveSection,
  getPackageApiSection,
} from './menu.utils';

export class MenuApi {
  private menuCache: Menu | null = null;

  constructor(
    private readonly documents: DocumentMetadata,
    private readonly packageDocuments: DocumentMetadata[] = []
  ) {}

  getMenu(): Menu {
    let menu = this.menuCache;

    if (menu) return menu;

    const items = createMenuItems(this.documents);
    if (items) {
      menu = {
        sections: [getBasicSection(items), getDeepDiveSection(items)],
      };
      if (!!this.packageDocuments.length)
        menu.sections.push(
          this.getReferenceApiMenuSection(this.packageDocuments)
        );
    } else {
      throw new Error(`Cannot find any documents`);
    }
    this.menuCache = menu;

    return menu;
  }

  getReferenceApiMenuSection(
    packageDocuments: DocumentMetadata[]
  ): MenuSection {
    const documents: DocumentMetadata = {
      id: 'packages',
      name: 'Packages',
      itemList: packageDocuments,
    };

    const items = createMenuItems(documents);
    return getPackageApiSection(items);
  }
}
