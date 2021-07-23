import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { DocSearchModal, useDocSearchKeyboardEvents } from '@docsearch/react';

const ACTION_KEY_DEFAULT = ['Ctrl ', 'Control'];
const ACTION_KEY_APPLE = ['⌘', 'Command'];

function Hit({ hit, children }) {
  return (
    <Link href={hit.url}>
      <a>{children}</a>
    </Link>
  );
}

export interface AlgoliaSearchProps {
  flavorId: string;
  versionId: string;
}
export function AlgoliaSearch({ flavorId, versionId }: AlgoliaSearchProps) {
  const frameworkFilter = `framework:${flavorId}`;
  const versionFilter = `version:${versionId}`;

  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const [initialQuery, setInitialQuery] = useState(null);
  const [browserDetected, setBrowserDetected] = useState(false);
  const [actionKey, setActionKey] = useState(ACTION_KEY_DEFAULT);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const handleInput = useCallback(
    (e) => {
      setIsOpen(true);
      setInitialQuery(e.key);
    },
    [setIsOpen, setInitialQuery]
  );

  useDocSearchKeyboardEvents({
    isOpen,
    onOpen: handleOpen,
    onClose: handleClose,
    onInput: handleInput,
    searchButtonRef,
  });

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      if (/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
        setActionKey(ACTION_KEY_APPLE);
      } else {
        setActionKey(ACTION_KEY_DEFAULT);
      }
      setBrowserDetected(true);
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="docsearch:version" content={versionId} />
        <meta name="docsearch:framework" content={flavorId} />
        <link
          rel="preconnect"
          href="https://BH4D9OD16A-dsn.algolia.net"
          crossOrigin="true"
        />
      </Head>
      <button
        type="button"
        ref={searchButtonRef}
        onClick={handleOpen}
        className="group leading-6 font-medium flex items-center space-x-3 sm:space-x-4 text-white opacity-90 hover:opacity-100 transition-colors duration-200 w-full py-2"
      >
        <svg width="24" height="24" fill="none" className="text-white">
          <path
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          <span className="hidden sm:inline">Quick </span>search
        </span>
        <span
          style={{ opacity: browserDetected ? '1' : '0' }}
          className="hidden sm:block text-sm leading-5 py-0.5 px-1.5 border border-white rounded-md"
        >
          <span className="sr-only">Press </span>
          <kbd className="font-sans">
            <abbr title={actionKey[1]} className="no-underline">
              {actionKey[0]}
            </abbr>
          </kbd>
          <span className="sr-only"> and </span>
          <kbd className="font-sans">K</kbd>
          <span className="sr-only"> to search</span>
        </span>
      </button>
      {isOpen &&
        createPortal(
          <DocSearchModal
            initialQuery={initialQuery}
            initialScrollY={window.scrollY}
            searchParameters={{
              facetFilters: [frameworkFilter, versionFilter],
              distinct: 1,
            }}
            onClose={handleClose}
            indexName="nx"
            apiKey="0c9c3fb22624056e7475eddcbcbfbe91"
            appId="BH4D9OD16A"
            navigator={{
              navigate({ suggestionUrl }) {
                setIsOpen(false);
                router.push(suggestionUrl);
              },
            }}
            hitComponent={Hit}
            transformItems={(items) => {
              return items.map((item) => {
                // We transform the absolute URL into a relative URL to
                // leverage Next's preloading.
                const a = document.createElement('a');
                a.href = item.url;

                const hash = a.hash === '#content-wrapper' ? '' : a.hash;

                return {
                  ...item,
                  url: `${a.pathname}${hash}`,
                };
              });
            }}
          />,
          document.body
        )}
    </>
  );
}
