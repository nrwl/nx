import React from 'react';
import cx from 'classnames';
import Head from 'next/head';
import {
  DocumentData,
  FlavorMetadata,
  Menu,
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
  return (
    <>
      <Head>
        <title>{document.data.title} - Nx</title>
        <meta name="twitter:title" content={document.data.title ?? `Nx`} />
        <meta
          name="twitter:description"
          content="With Nx, you can develop multiple full-stack applications holistically and share code between them all in the same workspace. Add Cypress, Jest, Prettier, and Storybook into your dev workflow."
        />
        <meta
          name="twitter:image"
          content="https://nx.dev/images/nx-media.jpg"
        />
        <meta
          name="twitter:image:alt"
          content="Nx: Smart, Extensible Build Framework"
        />
        <meta
          property="og:description"
          content="With Nx, you can develop multiple full-stack applications holistically and share code between them all in the same workspace. Add Cypress, Jest, Prettier, and Storybook into your dev workflow."
        />
        <meta property="og:title" content={document.data.title ?? `Nx`} />
        <meta
          property="og:image"
          content="https://nx.dev/images/nx-media.jpg"
        />
        <meta property="og:image:width" content="800" />
        <meta property="og:image:height" content="400" />
      </Head>
      <div className="w-full max-w-screen-lg mx-auto">
        <div className="lg:flex">
          <Sidebar
            menu={menu}
            version={version}
            flavor={flavor}
            navIsOpen={navIsOpen}
          />
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
