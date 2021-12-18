import React from 'react';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { BreadcrumbJsonLd, NextSeo } from 'next-seo';
import {
  DocumentData,
  FlavorMetadata,
  Menu,
  MenuItem,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import Content from './content';
import Sidebar from './sidebar';

export interface DocumentationFeatureDocViewerProps {
  version: VersionMetadata;
  flavor: FlavorMetadata;
  flavorList: FlavorMetadata[];
  versionList: VersionMetadata[];
  menu: Menu;
  document: DocumentData;
  toc: any;
  navIsOpen?: boolean;
}

export function DocViewer({
  document,
  version,
  versionList,
  menu,
  flavor,
  flavorList,
  navIsOpen,
}: DocumentationFeatureDocViewerProps) {
  const router = useRouter();

  return (
    <>
      <NextSeo
        noindex={version.id === 'previous'}
        title={document.data.title + ' | Nx'}
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: document.data.title,
          description:
            'Next generation build system with first class monorepo support and powerful integrations.',
          images: [
            {
              url: router.asPath.includes('turbo-and-nx')
                ? 'https://nx.dev/images/nx-media-monorepo.jpg'
                : 'https://nx.dev/images/nx-media.jpg',
              width: 800,
              height: 400,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          site_name: 'Nx',
          type: 'website',
        }}
      />
      <div className="w-full max-w-screen-lg mx-auto">
        <div className="lg:flex">
          <Sidebar menu={menu} navIsOpen={navIsOpen} />
          <div
            id="content-wrapper"
            className={cx(
              'min-w-0 w-full flex-auto lg:static lg:max-h-full lg:overflow-visible pt-16 md:pl-4',
              navIsOpen && 'overflow-hidden max-h-screen fixed'
            )}
          >
            <Content
              document={document}
              flavor={flavor}
              flavorList={flavorList}
              version={version}
              versionList={versionList}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default DocViewer;
