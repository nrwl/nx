import { MenuItem, MenuSection } from '@nrwl/nx-dev/models-menu';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import {
  ReferencesIndexItem,
  ReferencesSection,
} from '@nrwl/nx-dev/ui-references';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { nxMenuApi } from '../lib/api';

interface ReferencesProps {
  references: MenuSection;
}

export async function getStaticProps(): Promise<{ props: ReferencesProps }> {
  return {
    props: {
      references: nxMenuApi.getReferenceApiMenuSection(),
    },
  };
}

const nxPackageIds = ['nx', 'workspace', 'devkit', 'nx-plugin'];

export default function Packages(props: ReferencesProps): JSX.Element {
  const router = useRouter();
  const [pathname, hash = ''] = router.asPath.split('#');
  const validIds = useMemo(
    () => props.references.itemList.map((item) => item.id),
    [props.references]
  );
  const idFromHash = validIds.some((id) => hash === id) ? hash : '';
  const [targetPackageId, setTargetPackageId] = useState<string>('');

  // Only run this effect initially to sync the id once, or else we run into a hydration warning.
  useEffect(() => {
    setTargetPackageId(idFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL for deep-links
  useEffect(() => {
    if (hash === targetPackageId) return;
    if (targetPackageId) {
      router.replace(`${pathname}#${targetPackageId}`);
    } else {
      router.replace(pathname, undefined, { scroll: false });
    }
  }, [pathname, router, targetPackageId, hash]);

  const updateTargetPackageId = useCallback(
    (id: string) =>
      id === targetPackageId ? setTargetPackageId('') : setTargetPackageId(id),
    [targetPackageId]
  );
  const references: MenuItem[] = useMemo(
    () =>
      [
        ...nxPackageIds.map((id) =>
          props.references.itemList.find((pkg) => pkg.id === id)
        ),
        ...props.references.itemList.filter(
          (pkg) => !nxPackageIds.includes(pkg.id)
        ),
      ].filter((pkg): pkg is MenuItem => !!pkg),
    [props.references]
  );

  return (
    <>
      <NextSeo
        title="Reference: Official Packages & API"
        description="Reference: Official Packages & API"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Reference: Official Packages & API',
          description: 'Reference: Official Packages & API',
          images: [
            {
              url: 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 400,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'NxDev',
          type: 'website',
        }}
      />
      <Header useDarkBackground={false} />
      <main id="main" role="main">
        <div className="w-full">
          <article id="references" className="pt-16 sm:pt-24 lg:pt-32">
            <header className="mx-auto max-w-prose px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8">
              <div>
                <h1 className="text-blue-nx-base text-base font-semibold uppercase tracking-wider">
                  <span className="sr-only">Nx </span> Reference
                </h1>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-slate-800 sm:text-6xl">
                  Official Packages & API
                </p>
              </div>
            </header>
          </article>

          <section
            id="packages-section"
            className="relative mx-auto max-w-7xl py-12 px-4 sm:px-6 md:px-8 lg:pt-32"
          >
            <nav
              aria-labelledby="package-index-navigation"
              className="relative mb-24 grid grid-cols-2 gap-4 md:grid-cols-5"
            >
              {references.map((category: MenuItem, index, all) => (
                <ReferencesIndexItem
                  key={'ref-' + category.id}
                  path={category.path as string}
                  name={category.name as string}
                  id={category.id}
                  active={targetPackageId}
                  callback={updateTargetPackageId}
                />
              ))}
            </nav>

            {references
              .filter((pkg) =>
                !!targetPackageId ? pkg.id === targetPackageId : true
              )
              .map((category: MenuItem, index, all) => (
                <div key={[category.id, index].join('-')} className="py-10">
                  <ReferencesSection section={category} />
                  {!(index + 1 === all.length) && (
                    <div className="inset-x-0 bottom-0 mt-8 h-1 rounded-full bg-gradient-to-r from-[#8154E8] to-[#47BC99]"></div>
                  )}
                </div>
              ))}
          </section>
        </div>
      </main>
      <Footer useDarkBackground={false} />
    </>
  );
}
