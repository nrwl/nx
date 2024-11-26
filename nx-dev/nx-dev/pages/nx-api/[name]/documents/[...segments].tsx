import { DocumentsApi } from '@nx/nx-dev/data-access-documents/node-only';
import { getPackagesSections } from '@nx/nx-dev/data-access-menu';
import { sortCorePackagesFirst } from '@nx/nx-dev/data-access-packages';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
import { ProcessedDocument, RelatedDocument } from '@nx/nx-dev/models-document';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import { ProcessedPackageMetadata } from '@nx/nx-dev/models-package';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticPaths } from 'next';
import { menusApi } from '../../../../lib/menus.api';
import { useNavToggle } from '../../../../lib/navigation-toggle.effect';
import { nxPackagesApi } from '../../../../lib/packages.api';
import { tagsApi } from '../../../../lib/tags.api';
import { fetchGithubStarCount } from '../../../../lib/githubStars.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';

export default function PackageDocument({
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

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [
      ...nxPackagesApi.getStaticDocumentPaths().documents.map((x) => ({
        params: {
          name: x.params.segments.slice(1)[0],
          segments: x.params.segments.slice(3),
        },
      })),
    ],
    fallback: 'blocking',
  };
};

export async function getStaticProps({
  params,
}: {
  params: { name: string; segments: string[] };
}) {
  try {
    const segments = ['nx-api', params.name, 'documents', ...params.segments];
    const documents = new DocumentsApi({
      id: [params.name, 'documents'].join('-'),
      manifest: nxPackagesApi.getPackageDocuments(params.name),
      prefix: '',
      publicDocsRoot: 'public/documentation',
      tagsApi,
    });
    const document = documents.getDocument(segments);

    return {
      props: {
        pkg: nxPackagesApi.getPackage([params.name]),
        document,
        widgetData: {
          githubStarsCount: await fetchGithubStarCount(),
        },
        relatedDocuments: tagsApi
          .getAssociatedItemsFromTags(document.tags)
          .filter((item) => item.path !== '/' + segments.join('/')), // Remove currently displayed item
        menu: menusApi.getMenu('nx-api', ''),
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
}
