import { getBasicPluginsSection } from '@nx/nx-dev-data-access-menu';
import { DocViewer } from '@nx/nx-dev-feature-doc-viewer';
import { ProcessedDocument, RelatedDocument } from '@nx/nx-dev-models-document';
import { Menu, MenuItem } from '@nx/nx-dev-models-menu';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev-ui-common';
import { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { menusApi } from '../../lib/menus.api';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { nxPluginsApi } from '../../lib/plugins.api';
import { tagsApi } from '../../lib/tags.api';
import { fetchGithubStarCount } from '../../lib/githubStars.api';
import { ScrollableContent } from '@nx/nx-dev-ui-scrollable-content';

export default function Pages({
  document,
  menu,
  relatedDocuments,
  widgetData,
}: {
  document: ProcessedDocument;
  menu: MenuItem[];
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
      sections: [getBasicPluginsSection(menu)],
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
    paths: nxPluginsApi.getSlugsStaticDocumentPaths(),
    fallback: 'blocking',
  };
};
export const getStaticProps: GetStaticProps = async ({
  params,
}: {
  params: { segments: string[] };
}) => {
  try {
    const segments = ['extending-nx', ...params.segments];
    const document = nxPluginsApi.getDocument(segments);
    return {
      props: {
        document,
        widgetData: {
          githubStarsCount: await fetchGithubStarCount(),
        },
        relatedDocuments: tagsApi
          .getAssociatedItemsFromTags(document.tags)
          .filter((item) => item.path !== '/' + segments.join('/')), // Remove currently displayed item
        menu: menusApi.getMenu('extending-nx', ''),
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
