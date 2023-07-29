import {
  PackageMetadata,
  ProcessedPackageMetadata,
} from '@nx/nx-dev/models-package';
import { Breadcrumbs, Footer } from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';
import React from 'react';
import { Heading1, Heading2 } from './ui/headings';
import { DocumentList, SchemaList } from './ui/package-reference';
import { TopSchemaLayout } from './ui/top.layout';

export function PackageSchemaSubList({
  type,
  pkg,
}: {
  type: 'document' | 'executor' | 'generator';
  pkg: ProcessedPackageMetadata;
}): JSX.Element {
  const router = useRouter();
  const capitalize = (text: string): string =>
    text.charAt(0).toUpperCase() + text.slice(1);

  const vm: {
    package: PackageMetadata;
    githubUrl: string;
    seo: { title: string; description: string; url: string; imageUrl: string };
    type: 'document' | 'executor' | 'generator';
    heading: string;
  } = {
    package: {
      ...pkg,
      documents: Object.keys(pkg.documents)
        .map((k) => pkg.documents[k])
        .filter((d) => d.id !== 'overview'),
      executors: Object.keys(pkg.executors).map((k) => pkg.executors[k]),
      generators: Object.keys(pkg.generators).map((k) => pkg.generators[k]),
    },
    githubUrl: pkg.githubRoot + pkg.root,
    seo: {
      title: `${pkg.packageName}:${type}s | Nx`,
      description: pkg.description,
      imageUrl: `https://nx.dev/images/open-graph/${router.asPath
        .replace('/', '')
        .replace(/\//gi, '-')}.jpg`,
      url: 'https://nx.dev' + router.asPath,
    },
    type,
    heading: capitalize(type) + ' References',
  };

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

            <Heading1 title={vm.seo.title} />

            <Heading2 title={vm.heading} />

            <p className="mb-16">
              Here is a list of all {vm.type} available for this package.
            </p>

            {vm.type === 'document' ? (
              <>
                <DocumentList documents={vm.package.documents} />
              </>
            ) : null}

            {vm.type === 'executor' ? (
              <>
                <SchemaList files={vm.package.executors} type={'executor'} />
              </>
            ) : null}

            {vm.type === 'generator' ? (
              <>
                <SchemaList files={vm.package.generators} type={'generator'} />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
