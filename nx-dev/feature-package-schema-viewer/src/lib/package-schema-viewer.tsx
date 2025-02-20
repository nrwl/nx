import {
  ProcessedPackageMetadata,
  SchemaMetadata,
} from '@nx/nx-dev/models-package';
import { Breadcrumbs, Footer } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import Content from './content';
import { getSchemaViewModel, SchemaViewModel } from './get-schema-view-model';

export function PackageSchemaViewer({
  pkg,
  schema,
}: {
  pkg: ProcessedPackageMetadata;
  schema: SchemaMetadata;
}): JSX.Element {
  const router = useRouter();

  const vm: {
    schema: SchemaViewModel | null;
    seo: { title: string; description: string; url: string; imageUrl: string };
  } = {
    // Process the request and make available the needed schema information
    schema: getSchemaViewModel(router.query, pkg, schema),
    seo: {
      title: `${pkg.packageName}:${schema.name} | Nx`,
      description:
        'Build system, optimized for monorepos, with AI-powered architectural awareness and advanced CI capabilities.',
      imageUrl: `https://nx.dev/images/open-graph/${router.asPath
        .replace('/', '')
        .replace(/\//gi, '-')}.jpg`,
      url: 'https://nx.dev' + router.asPath,
    },
  };

  if (!vm.schema) throw new Error('Could not find schema: ' + schema.name);

  if (!vm.schema.currentSchema)
    throw new Error(
      'Could not interpret schema data: ' + vm.schema.schemaMetadata.name
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
              alt: 'Nx: Smart Monorepos · Fast CI',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <div className="mx-auto w-full grow items-stretch px-4 sm:px-6 lg:px-8 2xl:max-w-6xl">
        <div id="content-wrapper" className="w-full flex-auto flex-col">
          <div className="mb-6 pt-8">
            <Breadcrumbs path={router.asPath} />
          </div>
          <Content schemaViewModel={vm.schema} />
        </div>
      </div>
      <Footer />
    </>
  );
}
