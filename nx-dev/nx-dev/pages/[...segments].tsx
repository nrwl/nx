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
import type { GetStaticPaths, GetStaticProps } from 'next';
import { useCallback, useEffect, useState } from 'react';

import { FourOhFour } from './404';
import {
  nxCloudDocumentsApi,
  nxCloudMenuApi,
  nxDocumentsApi,
  nxMenuApi,
  packagesApi,
} from '../lib/api';

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

function SidebarButton(props: { onClick: () => void; navIsOpen: boolean }) {
  return (
    <button
      type="button"
      className="bg-green-nx-base fixed bottom-4 right-4 z-50 block h-16 w-16 rounded-full text-white shadow-sm lg:hidden"
      onClick={props.onClick}
    >
      <span className="sr-only">Open site navigation</span>
      <svg
        width="24"
        height="24"
        fill="none"
        className={cx(
          'absolute top-1/2 left-1/2 -mt-3 -ml-3 transform transition duration-300',
          {
            'scale-80 opacity-0': props.navIsOpen,
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
            'scale-80 opacity-0': !props.navIsOpen,
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
  );
}

export default function DocumentationPage(
  props: DocumentationPageProps
): JSX.Element {
  const { toggleNav, navIsOpen } = useNavToggle();

  if (props.statusCode === 404) {
    return <FourOhFour />;
  }

  const { menu, document, pkg, schemaRequest } = props;

  const vm: { entryComponent: JSX.Element } = {
    entryComponent: (
      <DocViewer
        document={document || ({} as any)}
        menu={{
          sections: menu.sections.filter((x) => x.id !== 'official-packages'),
        }}
        toc={null}
        navIsOpen={navIsOpen}
      />
    ),
  };

  if (!!pkg) {
    vm.entryComponent = <PackageSchemaList pkg={pkg} />;
  }

  if (!!pkg && !!schemaRequest) {
    vm.entryComponent = (
      <PackageSchemaViewer
        schemaRequest={{
          ...schemaRequest,
          pkg,
        }}
      />
    );
  }

  return (
    <>
      <Header isDocViewer={true} />
      <main id="main" role="main">
        {vm.entryComponent}
        {!pkg && <SidebarButton onClick={toggleNav} navIsOpen={navIsOpen} />}
      </main>
      {!navIsOpen ? <Footer /> : null}
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
      ...nxCloudDocumentsApi.getStaticDocumentPaths(),
    ],
    fallback: 'blocking',
  };
};
