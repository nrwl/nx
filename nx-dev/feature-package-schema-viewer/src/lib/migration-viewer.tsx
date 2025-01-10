import {
  MigrationMetadata,
  ProcessedPackageMetadata,
} from '@nx/nx-dev/models-package';
import { h2, table } from 'markdown-factory';
import { Breadcrumbs, Footer } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { ReactNode } from 'react';
import { Heading2 } from './ui/headings';

const getHeaderMarkdown = (data: {
  packageName: string;
  schemaName: string;
  description: string;
  type: 'executor' | 'generator' | 'migration';
}): string => {
  return [
    `# ${data.packageName}:${data.schemaName}`,
    `\n\n`,
    data.description,
    '\n\n',
  ].join('');
};

function getMarkdown(
  migration: MigrationMetadata,
  packageName: string
): {
  header: ReactNode;
  packages: ReactNode;
  customContent: ReactNode;
} {
  type FieldName = 'name' | 'version' | 'required';
  const items: Record<FieldName, string>[] = migration.packages
    ? Object.entries(migration.packages).map(([name, value]) => ({
        name,
        version: value.version,
        required: value.alwaysAddToPackageJson ? 'true' : 'false',
      }))
    : [];
  const fields: { field: FieldName; label: string }[] = [
    { field: 'name', label: 'Name' },
    { field: 'version', label: 'Version' },
    { field: 'required', label: 'Required' },
  ];
  return {
    header: renderMarkdown(
      getHeaderMarkdown({
        type: 'migration',
        packageName,
        schemaName: migration.name,
        description: migration.description,
      }),
      {
        filePath: '',
      }
    ).node,
    packages: renderMarkdown(h2('Packages', table(items, fields)), {
      filePath: '',
    }).node,
    customContent: !!migration['examplesFile']
      ? renderMarkdown(migration['examplesFile'], { filePath: '' }).node
      : null,
  };
}

export function MigrationViewer({
  pkg,
  schema,
}: {
  pkg: ProcessedPackageMetadata;
  schema: MigrationMetadata;
}): JSX.Element {
  const router = useRouter();

  const vm: {
    seo: { title: string; description: string; url: string; imageUrl: string };
    markdown?: {
      header: ReactNode;
      customContent: ReactNode;
      packages: ReactNode;
    };
  } = {
    // Process the request and make available the needed schema information
    seo: {
      title: `${pkg.packageName}:${schema.name} | Nx`,
      description:
        'Nx is a build system, optimized for monorepos, with plugins for popular frameworks and tools and advanced CI capabilities including caching and distribution.',
      imageUrl: `https://nx.dev/images/open-graph/${router.asPath
        .replace('/', '')
        .replace(/\//gi, '-')}.jpg`,
      url: 'https://nx.dev' + router.asPath,
    },
    markdown: getMarkdown(schema, pkg.packageName),
  };

  vm.seo.description = schema.description;

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
          <div
            data-document="main"
            className="min-w-0 flex-auto pb-24 pt-8 lg:pb-16"
          >
            <div className="mb-8 flex w-full items-center space-x-2">
              <div className="w-full flex-grow space-x-4">
                <div
                  aria-hidden="true"
                  data-tooltip="Schema type"
                  className="relative inline-flex rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase dark:border-slate-700 dark:bg-slate-800/60"
                >
                  migration
                </div>
              </div>
              <div className="relative z-0 inline-flex flex-shrink-0 rounded-md shadow-sm">
                <Link
                  href={`/nx-api/${pkg.name}`}
                  title="See package information"
                  className={cx(
                    'relative inline-flex items-center rounded-md rounded-l-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800'
                  )}
                >
                  {pkg.packageName}
                </Link>
              </div>
            </div>

            {/* We remove the top description on sub property lookup */}
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {vm.markdown?.header}
              <Heading2 title="Version"></Heading2>
              {schema.version}
              {schema.packages && vm.markdown?.packages}
              {vm.markdown?.customContent}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
