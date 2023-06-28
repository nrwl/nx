import { getBasicNxSection } from '@nx/nx-dev/data-access-menu';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
import { ProcessedDocument, RelatedDocument } from '@nx/nx-dev/models-document';
import { Menu, MenuItem } from '@nx/nx-dev/models-menu';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { menusApi } from '../lib/menus.api';
import { useNavToggle } from '../lib/navigation-toggle.effect';
import { nxDocumentationApi } from '../lib/nx.api';
import { tagsApi } from '../lib/tags.api';

export default function NxDocumentation({
  document,
  menu,
  relatedDocuments,
}: {
  document: ProcessedDocument;
  menu: MenuItem[];
  relatedDocuments: RelatedDocument[];
}) {
  const router = useRouter();
  const { toggleNav, navIsOpen } = useNavToggle();
  const wrapperElement = useRef(null);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (url.includes('#')) return;
      if (!wrapperElement) return;

      (wrapperElement as any).current.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router, wrapperElement]);

  const vm: {
    document: ProcessedDocument;
    menu: Menu;
    relatedDocuments: RelatedDocument[];
  } = {
    document,
    menu: {
      sections: [getBasicNxSection(menu)],
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
        <SidebarContainer menu={vm.menu} navIsOpen={navIsOpen} />
        <div
          ref={wrapperElement}
          id="wrapper"
          data-testid="wrapper"
          className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
        >
          <DocViewer
            document={vm.document}
            relatedDocuments={vm.relatedDocuments}
          />
        </div>
      </main>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = () => {
  const reservedPaths = [
    '/recipes',
    '/nx-cloud',
    '/packages',
    '/reference/changelog',
  ];
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
