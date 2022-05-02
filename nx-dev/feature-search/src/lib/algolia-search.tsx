import { DocSearchModal, useDocSearchKeyboardEvents } from '@docsearch/react';
import { SearchIcon } from '@heroicons/react/solid';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ACTION_KEY_DEFAULT = ['Ctrl ', 'Control'];
const ACTION_KEY_APPLE = ['⌘', 'Command'];

function Hit({ hit, children }) {
  return (
    <Link href={hit.url}>
      <a>{children}</a>
    </Link>
  );
}

export function AlgoliaSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const [initialQuery, setInitialQuery] = useState('');
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
        className="flex w-full items-center rounded-md py-1.5 pl-2 pr-3 text-sm leading-6 text-slate-300 ring-1 ring-slate-600 transition hover:text-slate-200 hover:ring-slate-500"
      >
        <SearchIcon className="mr-3 h-4 w-4 flex-none" />
        <span className="mx-3">
          <span className="hidden lg:inline">Quick </span>search
        </span>
        <span
          style={{ opacity: browserDetected ? '1' : '0' }}
          className="ml-auto hidden flex-none pl-3 text-xs font-semibold md:block"
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
            searchParameters={{
              facetFilters: ['language:en'],
              hitsPerPage: 100,
            }}
            initialQuery={initialQuery}
            placeholder="Search documentation"
            initialScrollY={window.scrollY}
            onClose={handleClose}
            indexName="nx-production"
            apiKey="f49a1eb671385f0472a7285556168930"
            appId="PCTGM1JTQL"
            navigator={{
              navigate({ itemUrl }) {
                setIsOpen(false);
                router.push(itemUrl);
              },
            }}
            hitComponent={Hit}
            transformItems={(items) => {
              return items.map((item, index) => {
                const a = document.createElement('a');
                a.href = item.url;

                const hash = a.hash === '#content-wrapper' ? '' : a.hash;

                if (item.hierarchy?.lvl0) {
                  item.hierarchy.lvl0 = item.hierarchy.lvl0.replace(
                    /&amp;/g,
                    '&'
                  );
                }

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
