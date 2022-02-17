import type { DocumentData, Menu } from '@nrwl/nx-dev/data-access-documents';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import cx from 'classnames';
import Router from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { documentsApi, menuApi } from '../lib/api';

interface DocumentationPageProps {
  menu: Menu;
  document: DocumentData;
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
  document,
  menu,
}: DocumentationPageProps) {
  const { toggleNav, navIsOpen } = useNavToggle();

  return (
    <>
      <Header isDocViewer={true} />
      <main>
        <DocViewer
          document={document}
          menu={menu}
          toc={null}
          navIsOpen={navIsOpen}
        />
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
  const menu = menuApi.getMenu();
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
      },
    };
  } else {
    return {
      redirect: {
        // If the menu is found, go to the first document, else go to homepage
        destination: menu?.sections[0].itemList?.[0].itemList?.[0].url ?? '/',
        permanent: false,
      },
    };
  }
}

export async function getStaticPaths() {
  return {
    paths: documentsApi.getStaticDocumentPaths(),
    fallback: 'blocking',
  };
}
