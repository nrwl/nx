import {
  PackageSchemaList,
  PackageSchemaViewer,
} from '@nrwl/nx-dev-feature-package-schema-viewer';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { DocumentData } from '@nrwl/nx-dev/models-document';
import { Menu } from '@nrwl/nx-dev/models-menu';
import { PackageMetadata } from '@nrwl/nx-dev/models-package';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import cx from 'classnames';
import Router from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import {
  nxCloudDocumentsApi,
  nxCloudMenuApi,
  nxDocumentsApi,
  nxMenuApi,
  packagesApi,
} from '../lib/api';

interface DocumentationPageProps {
  menu: Menu;
  document: DocumentData | null;
  pkg: PackageMetadata | null;
  schemaRequest: {
    type: 'executors' | 'generators';
    schemaName: string;
  } | null;
}

// We may want to extract this to another lib.
function useNavToggle() {
  const [navIsOpen, setNavIsOpen] = useState(false);
  const toggleNav = useCallback(() => {
    setNavIsOpen(!navIsOpen);
  }, [navIsOpen, setNavIsOpen]);

  useEffect(() => {
    if (!navIsOpen) return;

    function handleRouteChange() {
      setNavIsOpen(false);
    }

    Router.events.on('routeChangeComplete', handleRouteChange);

    return () => Router.events.off('routeChangeComplete', handleRouteChange);
  }, [navIsOpen, setNavIsOpen]);

  return { navIsOpen, toggleNav };
}

export default function DocumentationPage({
  menu,
  document,
  pkg,
  schemaRequest,
}: DocumentationPageProps) {
  const { toggleNav, navIsOpen } = useNavToggle();

  const vm: { entryComponent: JSX.Element } = {
    entryComponent: (
      <DocViewer
        document={document || ({} as any)}
        menu={menu}
        toc={null}
        navIsOpen={navIsOpen}
      />
    ),
  };

  if (!!pkg) {
    vm.entryComponent = (
      <PackageSchemaList menu={menu} navIsOpen={navIsOpen} pkg={pkg} />
    );
  }

  if (!!pkg && !!schemaRequest) {
    vm.entryComponent = (
      <PackageSchemaViewer
        menu={menu}
        schemaRequest={{
          ...schemaRequest,
          pkg,
        }}
        navIsOpen={navIsOpen}
      />
    );
  }

  return (
    <>
      <Header isDocViewer={true} />
      <main id="main" role="main">
        {vm.entryComponent}
        <button
          type="button"
          className="bg-green-nx-base fixed bottom-4 right-4 z-50 block h-16 w-16 rounded-full text-white shadow-sm lg:hidden"
          onClick={toggleNav}
        >
          <span className="sr-only">Open site navigation</span>
          <svg
            width="24"
            height="24"
            fill="none"
            className={cx(
              'absolute top-1/2 left-1/2 -mt-3 -ml-3 transform transition duration-300',
              {
                'scale-80 opacity-0': navIsOpen,
              }
            )}
          >
            <path
              d="M4 7h16M4 14h16M4 21h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <svg
            width="24"
            height="24"
            fill="none"
            className={cx(
              'absolute top-1/2 left-1/2 -mt-3 -ml-3 transform transition duration-300',
              {
                'scale-80 opacity-0': !navIsOpen,
              }
            )}
          >
            <path
              d="M6 18L18 6M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </main>
      {!navIsOpen ? <Footer /> : null}
    </>
  );
}

export async function getStaticProps({
  params,
}: {
  params: { segments: string[] };
}) {
  // Set Document and Menu apis
  let documentsApi = nxDocumentsApi;
  let menuApi = nxMenuApi;
  if (params.segments[0] === 'nx-cloud') {
    documentsApi = nxCloudDocumentsApi;
    menuApi = nxCloudMenuApi;
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
        redirect: {
          // If the menu is found, go to the first document, else go to homepage
          destination:
            menu?.sections[0].itemList?.[0].itemList?.[0].path ?? '/',
          permanent: false,
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

  let document: DocumentData | undefined;
  try {
    document = documentsApi.getDocument(params.segments);
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
  } else {
    return {
      redirect: {
        // If the menu is found, go to the first document, else go to homepage
        destination: menu?.sections[0].itemList?.[0].itemList?.[0].path ?? '/',
        permanent: false,
      },
    };
  }
}

export async function getStaticPaths() {
  return {
    paths: [
      ...packagesApi.getStaticPackagePaths(),
      ...nxDocumentsApi.getStaticDocumentPaths(),
      ...nxCloudDocumentsApi.getStaticDocumentPaths(),
    ],
    fallback: 'blocking',
  };
}
