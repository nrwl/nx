import { getBasicNxSection } from '@nx/nx-dev/data-access-menu';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
import { ProcessedDocument, RelatedDocument } from '@nx/nx-dev/models-document';
import { MenuItem } from '@nx/nx-dev/models-menu';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticPaths, GetStaticProps } from 'next';
import { menusApi } from '../lib/menus.api';
import { useNavToggle } from '../lib/navigation-toggle.effect';
import { nxDocumentationApi } from '../lib/nx.api';
import { tagsApi } from '../lib/tags.api';
import { fetchGithubStarCount } from '../lib/githubStars.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';

export default function NxDocumentation({
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

  const menuWithSections = {
    sections: [getBasicNxSection(menu)],
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
          menu={menuWithSections}
          toggleNav={toggleNav}
          navIsOpen={navIsOpen}
        />
        <ScrollableContent resetScrollOnNavigation={true}>
          <DocViewer
            document={document}
            relatedDocuments={relatedDocuments}
            widgetData={widgetData}
          />
        </ScrollableContent>
      </main>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = () => {
  const reservedPaths = ['/ci', '/nx-api', '/changelog'];
  return {
    paths: nxDocumentationApi
      .getSlugsStaticDocumentPaths()
      .filter(
        (path) => !reservedPaths.some((reserved) => path.startsWith(reserved))
      ),
    fallback: 'blocking',
  };
};
export const getStaticProps: GetStaticProps = async ({
  params,
}: {
  params: { segments: string[] };
}) => {
  try {
    const document = nxDocumentationApi.getDocument(params.segments);
    return {
      props: {
        document,
        widgetData: {
          githubStarsCount: await fetchGithubStarCount(),
        },
        relatedDocuments: tagsApi
          .getAssociatedItemsFromTags(document.tags)
          .filter((item) => item.path !== '/' + params.segments.join('/')), // Remove currently displayed item
        menu: menusApi.getMenu('nx', ''),
      },
    };
  } catch (e) {
    return {
      notFound: true,
      props: {
        statusCode: 404,
      },
    };
  }
};
