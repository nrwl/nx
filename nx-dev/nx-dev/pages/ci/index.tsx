import { getBasicNxCloudSection } from '@nx/nx-dev/data-access-menu';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
import { ProcessedDocument, RelatedDocument } from '@nx/nx-dev/models-document';
import { Menu, MenuItem } from '@nx/nx-dev/models-menu';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticProps } from 'next';
import { ciApi } from '../../lib/ci.api';
import { menusApi } from '../../lib/menus.api';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { tagsApi } from '../../lib/tags.api';
import { fetchGithubStarCount } from '../../lib/githubStars.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';

export default function CloudRoot({
  document,
  menu,
  relatedDocuments,
  widgetData,
}: {
  document: ProcessedDocument;
  menu: MenuItem[];
  relatedDocuments: RelatedDocument[];
  widgetData: { githubStarsCount: number };
}) {
  const { toggleNav, navIsOpen } = useNavToggle();

  const vm: {
    document: ProcessedDocument;
    menu: Menu;
    relatedDocuments: RelatedDocument[];
  } = {
    document,
    menu: {
      sections: [getBasicNxCloudSection(menu)],
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
            document={document}
            relatedDocuments={vm.relatedDocuments}
            widgetData={widgetData}
          />
        </ScrollableContent>
      </main>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const document = ciApi.generateRootDocumentIndex({
    name: 'ci',
    description: 'Learn about using Nx in CI',
  });
  return {
    props: {
      document,
      widgetData: {
        githubStarsCount: await fetchGithubStarCount(),
      },
      menu: menusApi.getMenu('ci', ''),
      relatedDocuments: document.tags
        .map((t) => tagsApi.getAssociatedItems(t))
        .flat(),
    },
  };
};
