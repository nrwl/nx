import { getPackagesSections } from '@nx/nx-dev/data-access-menu';
import { sortCorePackagesFirst } from '@nx/nx-dev/data-access-packages';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
import { ProcessedDocument, RelatedDocument } from '@nx/nx-dev/models-document';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import { ProcessedPackageMetadata } from '@nx/nx-dev/models-package';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { menusApi } from '../../../../lib/menus.api';
import { useNavToggle } from '../../../../lib/navigation-toggle.effect';
import { content } from '../../../../lib/rspack/content/rspack-plugin';
import { pkg } from '../../../../lib/rspack/pkg';
import { fetchGithubStarCount } from '../../../../lib/githubStars.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';

export default function RspackPlugins({
  document,
  menu,
  relatedDocuments,
  widgetData,
}: {
  document: ProcessedDocument;
  menu: MenuItem[];
  pkg: ProcessedPackageMetadata;
  relatedDocuments: RelatedDocument[];
  widgetData: { githubStarsCount: number };
}): JSX.Element {
  const { toggleNav, navIsOpen } = useNavToggle();

  const vm: {
    document: ProcessedDocument;
    menu: Menu;
    relatedDocuments: RelatedDocument[];
  } = {
    document,
    menu: {
      sections: sortCorePackagesFirst<MenuSection>(
        getPackagesSections(menu),
        'id'
      ),
    },
    relatedDocuments,
  };

  return (
    <div id="shell" className="flex h-full flex-col">
      <div className="w-full flex-shrink-0">
        <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
      </div>
      <main
        id="main"
        role="main"
        className="flex h-full flex-1 overflow-y-hidden"
      >
        <SidebarContainer
          menu={vm.menu}
          navIsOpen={navIsOpen}
          toggleNav={toggleNav}
        />
        <ScrollableContent resetScrollOnNavigation={true}>
          <DocViewer
            document={vm.document}
            relatedDocuments={vm.relatedDocuments}
            widgetData={widgetData}
          />
        </ScrollableContent>
      </main>
    </div>
  );
}

export async function getStaticProps() {
  const document = {
    content: content,
    description: 'Rspack plugins',
    filePath: '',
    id: 'rspack-plugins',
    name: 'Rspack plugins',
    relatedDocuments: {},
    tags: [],
  };

  return {
    props: {
      pkg,
      document,
      widgetData: {
        githubStarsCount: await fetchGithubStarCount(),
      },
      relatedDocuments: [],
      menu: menusApi.getMenu('nx-api', ''),
    },
  };
}
