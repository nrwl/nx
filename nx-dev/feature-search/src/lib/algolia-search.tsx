import { DocSearchModal, useDocSearchKeyboardEvents } from '@docsearch/react';
import {
  InternalDocSearchHit,
  StoredDocSearchHit,
} from '@docsearch/react/dist/esm/types';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ACTION_KEY_DEFAULT = ['Ctrl ', 'Control'];
const ACTION_KEY_APPLE = ['⌘', 'Command'];

function Hit({
  hit,
  children,
}: {
  hit: InternalDocSearchHit | StoredDocSearchHit;
  children: ReactNode;
}): JSX.Element {
  return <Link href={hit.url}>{children}</Link>;
}

export function AlgoliaSearch({
  tiny = false,
}: {
  tiny?: boolean;
}): JSX.Element {
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
    (event: KeyboardEvent) => {
      setIsOpen(true);
      setInitialQuery(event.key);
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
          href="https://PCTGM1JTQL-dsn.algolia.net"
          crossOrigin="anonymous"
        />
      </Head>
      {!tiny ? (
        <button
          type="button"
          ref={searchButtonRef}
          onClick={handleOpen}
          className="flex w-full items-center rounded-md bg-white px-2 py-1.5 text-sm leading-4 ring-1 ring-slate-300 transition dark:bg-slate-700 dark:ring-slate-900"
        >
          <MagnifyingGlassIcon className="h-4 w-4 flex-none" />
          <span className="mx-3 inline-flex text-xs text-slate-300 md:text-sm dark:text-slate-400">
            Search
          </span>
          <span
            style={{ opacity: browserDetected ? '1' : '0' }}
            className="ml-auto hidden flex-none rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs font-semibold text-slate-500 md:block dark:border-slate-700 dark:bg-slate-800/60"
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
      ) : (
        <button
          type="button"
          ref={searchButtonRef}
          onClick={handleOpen}
          className="inline-flex items-center"
        >
          <span
            style={{ opacity: browserDetected ? '1' : '0' }}
            className="ml-auto block flex-none rounded-md border border-slate-200 bg-slate-50/60 px-1 py-0.5 text-xs font-semibold text-slate-400 transition hover:text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500 dark:hover:text-slate-400"
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
      )}

      {isOpen &&
        createPortal(
          <DocSearchModal
            searchParameters={{
              facetFilters: ['language:en'],
              hitsPerPage: 100,
              distinct: true,
            }}
            initialQuery={initialQuery}
            placeholder="Search the docs"
            initialScrollY={window.scrollY}
            onClose={handleClose}
            indexName={`${process.env.NEXT_PUBLIC_SEARCH_INDEX}`}
            apiKey={`${process.env.NEXT_PUBLIC_SEARCH_API_KEY}`}
            appId={`${process.env.NEXT_PUBLIC_SEARCH_APP_ID}`}
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
