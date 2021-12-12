import React, { useCallback, useEffect, useState } from 'react';
import Router, { useRouter } from 'next/router';
import cx from 'classnames';
import { NextSeo } from 'next-seo';
import type {
  DocumentData,
  FlavorMetadata,
  Menu,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import { documentsApi, menuApi } from '../lib/api';
import {
  useActiveFlavor,
  useActiveVersion,
  useFlavors,
  useVersions,
  VersionsAndFlavorsProvider,
} from '@nrwl/nx-dev/feature-versions-and-flavors';
import {
  FlavorSelectionDialog,
  pathCleaner,
  useSelectedFlavor,
} from '@nrwl/nx-dev/feature-flavor-selection';

const flavorList = documentsApi.getFlavors();
const versionList = documentsApi.getVersions();
const defaultVersion = versionList.find((v) => v.default) as VersionMetadata;
const defaultFlavor = flavorList.find((f) => f.default) as FlavorMetadata;

interface DocumentationPageProps {
  version: VersionMetadata;
  flavor: FlavorMetadata;
  flavors: FlavorMetadata[];
  versions: VersionMetadata[];
  menu: Menu;
  document: DocumentData;
  isFallback: boolean;
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

// This wrapper is needed to provide the version and flavor value to the context.
// Child components will be able to use hooks to get these values (e.g. `useActiveFlavor()`).
export default function DocumentationPageWrapper(
  props: DocumentationPageProps
) {
  return (
    <VersionsAndFlavorsProvider
      value={{
        flavors: props.flavors,
        versions: props.versions,
        isFallbackActiveFlavor: props.isFallback,
        activeFlavor: props.flavor,
        activeVersion: props.version,
      }}
    >
      <DocumentationPage {...props} />
    </VersionsAndFlavorsProvider>
  );
}

export function DocumentationPage({ document, menu }: DocumentationPageProps) {
  const router = useRouter();
  const versions = useVersions();
  const flavors = useFlavors();
  const activeFlavor = useActiveFlavor();
  const activeVersion = useActiveVersion();
  const { flavorSelected, setSelectedFlavor } = useSelectedFlavor();
  const { toggleNav, navIsOpen } = useNavToggle();
  const cleanPath = pathCleaner(versions, flavors);

  return (
    <>
      <NextSeo
        canonical={`/${activeVersion.alias}/${activeFlavor.alias}`.concat(
          cleanPath(router.asPath)
        )}
      />
      <Header
        showSearch={true}
        version={{ name: activeVersion.name, value: activeVersion.alias }}
        flavor={{ name: activeFlavor.name, value: activeFlavor.alias }}
      />
      <main>
        <DocViewer
          version={activeVersion}
          versionList={versions}
          flavor={activeFlavor}
          flavorList={flavors}
          document={document}
          menu={menu}
          toc={null}
          navIsOpen={navIsOpen}
        />
        <button
          type="button"
          className="fixed z-50 bottom-4 right-4 w-16 h-16 rounded-full bg-green-nx-base shadow-sm text-white block lg:hidden"
          onClick={toggleNav}
        >
          <span className="sr-only">Open site navigation</span>
          <svg
            width="24"
            height="24"
            fill="none"
            className={cx(
              'absolute top-1/2 left-1/2 -mt-3 -ml-3 transition duration-300 transform',
              {
                'opacity-0 scale-80': navIsOpen,
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
              'absolute top-1/2 left-1/2 -mt-3 -ml-3 transition duration-300 transform',
              {
                'opacity-0 scale-80': !navIsOpen,
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
      <FlavorSelectionDialog
        open={!flavorSelected}
        version={activeVersion}
        onSelect={setSelectedFlavor}
      />
    </>
  );
}

export async function getStaticProps({
  params,
}: {
  params: { segments: string[] };
}) {
  const version =
    versionList.find((item) =>
      [item.id, item.alias].includes(params.segments[0])
    ) ?? defaultVersion;
  const flavor =
    flavorList.find((item) =>
      [item.id, item.alias].includes(params.segments[1])
    ) ?? defaultFlavor;

  // If we use the ID of version or flavor, redirect using the ALIAS instead (redirection is permanent)
  if (params.segments[0] === version.id || params.segments[1] === flavor.id) {
    return {
      redirect: {
        destination: `/${version.alias}/${flavor.alias}/${params.segments
          .splice(2)
          .join('/')}`,
        permanent: true,
      },
    };
  }

  const { document, menu, isFallback } = findDocumentAndMenu(
    version,
    flavor,
    params.segments
  );

  if (document) {
    return {
      props: {
        version,
        flavor,
        versions: versionList,
        flavors: flavorList,
        document,
        menu,
        isFallback: isFallback,
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
  const allPaths = versionList.flatMap((v) =>
    flavorList.flatMap((f) => documentsApi.getStaticDocumentPaths(v, f))
  );

  return {
    paths: allPaths,
    fallback: 'blocking',
  };
}

function findDocumentAndMenu(
  version: VersionMetadata,
  flavor: FlavorMetadata,
  segments: string[]
): {
  menu: undefined | Menu;
  document: undefined | DocumentData;
  isFallback?: boolean;
} {
  const isFallback =
    segments[0] !== version.alias || segments[1] !== flavor.alias;
  const path = isFallback ? segments : segments.slice(2);

  let menu: undefined | Menu = undefined;
  let document: undefined | DocumentData = undefined;

  try {
    menu = menuApi.getMenu(version, flavor);
    document = documentsApi.getDocument(version, flavor, path);
  } catch {
    // nothing
  }
  return { document, menu, isFallback };
}
