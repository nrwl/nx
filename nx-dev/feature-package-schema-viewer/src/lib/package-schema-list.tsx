import {
  MigrationMetadata,
  PackageMetadata,
  ProcessedPackageMetadata,
} from '@nx/nx-dev/models-package';
import { Breadcrumbs, Footer } from '@nx/nx-dev/ui-common';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import React, { ReactNode } from 'react';
import { Heading1, Heading2 } from './ui/headings';
import { DocumentList, SchemaList } from './ui/package-reference';
import { TopSchemaLayout } from './ui/top.layout';
import { major, minor } from 'semver';
import { MigrationViewer } from './migration-viewer';
import { VersionLabelListItem } from './package-schema-sub-list';

export function PackageSchemaList({
  overview,
  pkg,
  migrations,
}: {
  overview: string;
  pkg: ProcessedPackageMetadata;
  migrations?: MigrationMetadata[];
}): JSX.Element {
  const router = useRouter();

  const vm: {
    package: PackageMetadata;
    githubUrl: string;
    seo: { title: string; description: string; url: string; imageUrl: string };
    markdown: ReactNode;
  } = {
    package: {
      ...pkg,
      documents: Object.keys(pkg.documents)
        .map((k) => pkg.documents[k])
        .filter((d) => d.id !== 'overview'),
      executors: Object.keys(pkg.executors).map((k) => pkg.executors[k]),
      generators: Object.keys(pkg.generators).map((k) => pkg.generators[k]),
      migrations: Object.keys(pkg.migrations).map((k) => pkg.migrations[k]),
    },
    githubUrl: pkg.githubRoot + pkg.root,
    seo: {
      title: `${pkg.packageName} | Nx`,
      description: pkg.description,
      imageUrl: `https://nx.dev/images/open-graph/${router.asPath
        .replace('/', '')
        .replace(/\//gi, '-')}.jpg`,
      url: 'https://nx.dev' + router.asPath,
    },
    markdown: renderMarkdown(overview, {
      filePath: pkg.documents['overview'] ? pkg.documents['overview'].file : '',
    }).node,
  };

  const filesAndLabels: (string | MigrationMetadata)[] = [];
  let currentVersion = '';
  ((migrations as any) || []).forEach((file: MigrationMetadata) => {
    const minorVersion = `${major(file.version)}.${minor(file.version)}.x`;
    if (currentVersion !== minorVersion) {
      currentVersion = minorVersion;
      filesAndLabels.push(minorVersion);
    }
    filesAndLabels.push(file);
  });

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
              alt: 'Nx: Smart Repos · Fast Builds',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <div className="mx-auto w-full grow items-stretch px-4 pb-12 sm:px-6 lg:px-8 2xl:max-w-6xl">
        <div id="content-wrapper" className="w-full flex-auto flex-col">
          <div className="mb-6 pt-8">
            <Breadcrumbs path={router.asPath} />
          </div>
          <div data-document="main">
            <TopSchemaLayout name={vm.package.packageName} url={vm.githubUrl} />

            <Heading1 title={vm.package.packageName} />

            <div className="prose dark:prose-invert mb-16 max-w-none">
              {vm.markdown}
            </div>

            <Heading2 title="Package reference" />

            <p className="mb-16">
              Here is a list of all the executors, generators and migrations
              available from this package.
            </p>

            <Heading2 title={'Guides'} />
            <DocumentList documents={vm.package.documents} />

            <div className="h-12">{/* SPACER */}</div>
            <Heading2 title={'Executors'} />
            <SchemaList files={vm.package.executors} type={'executor'} />

            <div className="h-12">{/* SPACER */}</div>
            <Heading2 title={'Generators'} />
            <SchemaList files={vm.package.generators} type={'generator'} />

            <div className="h-12">{/* SPACER */}</div>
            <Heading2 title={'Migrations'} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {!!filesAndLabels.length
                ? filesAndLabels.map((schema) =>
                    typeof schema === 'string' ? (
                      <VersionLabelListItem
                        key={schema}
                        label={schema}
                      ></VersionLabelListItem>
                    ) : (
                      <MigrationViewer
                        key={schema.name}
                        schema={schema}
                      ></MigrationViewer>
                    )
                  )
                : undefined}
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
