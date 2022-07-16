import { Menu } from '@nrwl/nx-dev/models-menu';
import { Breadcrumbs, Footer, SidebarContainer } from '@nrwl/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import Content from './content';
import { getSchemaViewModel, SchemaViewModel } from './get-schema-view-model';
import { SchemaRequest } from './schema-request.models';

export function PackageSchemaViewer({
  menu,
  navIsOpen,
  schemaRequest,
}: {
  menu: Menu;
  navIsOpen: boolean;
  schemaRequest: SchemaRequest;
}): JSX.Element {
  const router = useRouter();
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

  const vm: {
    schema: SchemaViewModel | null;
    seo: { title: string; description: string; url: string; imageUrl: string };
  } = {
    // Process the request and make available the needed schema information
    schema: getSchemaViewModel(router.query, schemaRequest),
    seo: {
      title: `${schemaRequest.pkg.packageName}:${schemaRequest.schemaName} | Nx`,
      description:
        'Next generation build system with first class monorepo support and powerful integrations.',
      imageUrl: `https://nx.dev/images/open-graph/${router.asPath
        .replace('/', '')
        .replace(/\//gi, '-')}.jpg`,
      url: 'https://nx.dev' + router.asPath,
    },
  };

  // TODO@ben link up this to HTML component
  if (!vm.schema)
    throw new Error('Could not find schema: ' + schemaRequest.schemaName);

  // TODO@ben link up this to HTML component
  if (!vm.schema.currentSchema)
    throw new Error(
      'Could not interpret schema data: ' + schemaRequest.schemaName
    );

  vm.seo.description = vm.schema.currentSchema.description;

  return (
    <>
      <NextSeo
        title={vm.seo.title}
        openGraph={{
          url: vm.seo.url,
          title: vm.seo.title,
          description: vm.seo.description,
          images: [
            {
              url: vm.seo.imageUrl,
              width: 1600,
              height: 800,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'Nx',
          type: 'website',
        }}
      />
      <SidebarContainer menu={menu} navIsOpen={navIsOpen} />
      <div
        ref={wrapperElement}
        id="wrapper"
        data-testid="wrapper"
        className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
      >
        <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
          <div id="content-wrapper" className="w-full flex-auto flex-col">
            <div className="mb-6 pt-8">
              <Breadcrumbs path={router.asPath} />
            </div>
            <Content schemaViewModel={vm.schema} />
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
