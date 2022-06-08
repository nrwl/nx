import { Menu } from '@nrwl/nx-dev/models-menu';
import { Sidebar } from '@nrwl/nx-dev/ui-common';
import cx from 'classnames';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import { ReactComponentElement } from 'react';
import Content from './content';
import { getPublicPackageName } from './get-public-package-name';
import { getSchemaViewModel, SchemaViewModel } from './get-schema-view-model';
import { SchemaRequest } from './schema-request.models';

export function PackageSchemaViewer({
  schemaRequest,
  menu,
  navIsOpen,
}: {
  schemaRequest: SchemaRequest;
  menu: Menu;
  navIsOpen?: boolean;
}): ReactComponentElement<any> {
  const router = useRouter();

  const vm: {
    schema: SchemaViewModel | null;
    seo: { title: string; description: string; url: string; imageUrl: string };
  } = {
    // Process the request and make available the needed schema information
    schema: getSchemaViewModel(router.query, schemaRequest),
    seo: {
      title: `${getPublicPackageName(schemaRequest.pkg.name)}:${
        schemaRequest.schemaName
      } | Nx`,
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
      <div className="mx-auto w-full max-w-screen-lg">
        <div className="lg:flex">
          <Sidebar menu={menu} navIsOpen={navIsOpen} />
          <div
            id="content-wrapper"
            className={cx(
              'w-full min-w-0 flex-auto flex-col pt-16 md:pl-4 lg:static lg:max-h-full lg:overflow-visible',
              navIsOpen && 'fixed max-h-screen overflow-hidden'
            )}
          >
            <Content schemaViewModel={vm.schema} />
          </div>
        </div>
      </div>
    </>
  );
}

export default PackageSchemaViewer;
