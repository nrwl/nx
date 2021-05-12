import React from 'react';
import Content from './content';
import Head from 'next/head';
import { Menu } from '@nrwl/nx-dev/data-access-menu';
import {
  DocumentData,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

import Sidebar from './sidebar';

export interface DocumentationFeatureDocViewerProps {
  version: VersionMetadata;
  flavor: { label: string; value: string };
  flavorList: { label: string; value: string }[];
  versionList: VersionMetadata[];
  menu: Menu;
  document: DocumentData;
  toc: any;
}

export function DocViewer({
  document,
  version,
  versionList,
  menu,
  flavor,
  flavorList,
}: DocumentationFeatureDocViewerProps) {
  return (
    <>
      <Head>
        <title>
          {document.data.title} | Nx {flavor.label} documentation
        </title>
      </Head>
      <div className="w-full max-w-screen-xl max-w-8xl mx-auto">
        <div className="lg:flex">
          <Sidebar
            menu={menu}
            version={version}
            flavor={flavor}
            flavorList={flavorList}
            versionList={versionList}
          />
          <div
            id="content-wrapper"
            className="min-w-0 w-full flex-auto lg:static lg:max-h-full lg:overflow-visible"
          >
            <Content
              document={document}
              flavor={flavor.value}
              version={version.path}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default DocViewer;
