import { getBasicRecipesSection } from '@nrwl/nx-dev/data-access-menu';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import {
  ProcessedDocument,
  RelatedDocument,
} from '@nrwl/nx-dev/models-document';
import { Menu, MenuItem } from '@nrwl/nx-dev/models-menu';
import { DocumentationHeader, SidebarContainer } from '@nrwl/nx-dev/ui-common';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { menusApi } from '../../lib/menus.api';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { nxRecipesApi } from '../../lib/recipes.api';
import { tagsApi } from '../../lib/tags.api';

export default function RecipesRoot({
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
      sections: [getBasicRecipesSection(menu)],
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
            document={document}
            relatedDocuments={vm.relatedDocuments}
          />
        </div>
      </main>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const document = nxRecipesApi.generateRootDocumentIndex({
    name: 'Recipes',
    description: 'Learn quickly how to do things with Nx.',
  });
  return {
    props: {
      document,
      menu: menusApi.getMenu('recipes', ''),
      relatedDocuments: document.tags
        .map((t) => tagsApi.getAssociatedItems(t))
        .flat(),
    },
  };
};
