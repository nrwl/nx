import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { DocSearchModal, useDocSearchKeyboardEvents } from '@docsearch/react';

const ACTION_KEY_DEFAULT = ['Ctrl ', 'Control'];
const ACTION_KEY_APPLE = ['⌘', 'Command'];

// TODO@ben: remove replace pattern when Algolia is updated
function Hit({ hit, children }) {
  return (
    <Link href={hit.url.replace(/\/(p|l)\/(a|r|n)/, '')}>
      <a>{children}</a>
    </Link>
  );
}

export function AlgoliaSearch() {
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
        className="group flex w-full items-center space-x-3 py-2 font-medium leading-6 text-white opacity-90 transition-colors duration-200 hover:opacity-100 sm:space-x-4"
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
          className="hidden rounded-md border border-white py-0.5 px-1.5 text-sm leading-5 sm:block"
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
