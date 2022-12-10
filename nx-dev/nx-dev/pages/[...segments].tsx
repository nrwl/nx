import {
  PackageSchemaList,
  PackageSchemaViewer,
} from '@nrwl/nx-dev-feature-package-schema-viewer';
import { sortCorePackagesFirst } from '@nrwl/nx-dev/data-access-packages';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { DocumentData } from '@nrwl/nx-dev/models-document';
import { Menu, MenuItem, MenuSection } from '@nrwl/nx-dev/models-menu';
import { PackageMetadata } from '@nrwl/nx-dev/models-package';
import { DocumentationHeader, SidebarContainer } from '@nrwl/nx-dev/ui-common';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import {
  nxCloudDocumentsApi,
  nxCloudMenuApi,
  nxDocumentsApi,
  nxMenuApi,
  nxRecipesApi,
  nxRecipesMenuApi,
  packagesApi,
} from '../lib/api';
import { useNavToggle } from '../lib/navigation-toggle.effect';
import { FourOhFour } from './404';

type DocumentationPageProps =
  | { statusCode: 404 }
  | {
      statusCode: 200;
      menu: Menu;
      document: DocumentData | null;
      pkg: PackageMetadata | null;
      schemaRequest: {
        type: 'executors' | 'generators';
        schemaName: string;
      } | null;
    };

export default function DocumentationPage(
  props: DocumentationPageProps
): JSX.Element {
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

  if (props.statusCode === 404) {
    return <FourOhFour />;
  }

  const { menu, document, pkg, schemaRequest } = props;

  const vm: { entryComponent: JSX.Element; menu: Menu } = {
    entryComponent: <DocViewer document={document || ({} as any)} toc={null} />,
    menu: {
      sections: menu.sections.filter((x) => x.id !== 'official-packages'),
    },
  };

  if (!!pkg) {
    const reference: MenuSection | null =
      menu.sections.find((x) => x.id === 'official-packages') ?? null;
    if (!reference)
      throw new Error('Could not find menu section for "official-packages".');
    vm.menu = {
      sections: sortCorePackagesFirst<MenuItem>(reference.itemList).map(
        (x) => ({ ...x, hideSectionHeader: false })
      ),
    };

    vm.entryComponent = !!schemaRequest ? (
      <PackageSchemaViewer
        schemaRequest={{
          ...schemaRequest,
          pkg,
        }}
      />
    ) : (
      <PackageSchemaList navIsOpen={navIsOpen} menu={vm.menu} pkg={pkg} />
    );
  }

  return (
    <>
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
            {vm.entryComponent}
          </div>
        </main>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async ({
  params,
}: {
  params: { segments: string[] };
}) => {
  // Set Document and Menu apis
  let documentsApi = nxDocumentsApi;
  let menuApi = nxMenuApi;
  if (params.segments[0] === 'nx-cloud') {
    documentsApi = nxCloudDocumentsApi;
    menuApi = nxCloudMenuApi;
  }
  if (params.segments[0] === 'recipes') {
    documentsApi = nxRecipesApi;
    menuApi = nxRecipesMenuApi;
  }

  const menu = menuApi.getMenu();

  if (params.segments[0] === 'packages') {
    let pkg: PackageMetadata | null = null;
    try {
      pkg = packagesApi.getPackage(params.segments[1]);
    } catch (e) {
      // Do nothing
    }

    // TODO@ben: handle packages view routes?
    if (!pkg || (params.segments.length < 4 && 2 < params.segments.length)) {
      return {
        notFound: true,
        props: {
          statusCode: 404,
        },
      };
    }

    // TODO@ben: handle packages view routes?
    if (pkg && params.segments.length === 2) {
      return {
        props: {
          document: null,
          menu: nxMenuApi.getMenu(),
          pkg,
          schemaRequest: null,
        },
      };
    }

    return {
      props: {
        document: null,
        menu: nxMenuApi.getMenu(),
        pkg,
        schemaRequest: {
          type: params.segments[2],
          schemaName: params.segments[3],
        },
      },
    };
  }

  let document: DocumentData | null = null;
  try {
    document = documentsApi.getDocument(params.segments);
  } catch (e) {
    // Do nothing
  }
  try {
    if (!document) document = documentsApi.getDocumentIndex(params.segments);
  } catch (e) {
    // Do nothing
  }

  if (document) {
    return {
      props: {
        document,
        menu,
        schemaRequest: null,
      },
    };
  }

  return {
    notFound: true,
    props: {
      statusCode: 404,
    },
  };
};

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [
      ...packagesApi.getStaticPackagePaths(),
      ...nxDocumentsApi.getStaticDocumentPaths(),
      ...nxRecipesApi.getStaticDocumentPaths(),
      ...nxCloudDocumentsApi.getStaticDocumentPaths(),
    ],
    fallback: 'blocking',
  };
};
