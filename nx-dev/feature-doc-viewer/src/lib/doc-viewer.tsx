import React from 'react';
import Content from './content';
import Head from 'next/head';
import { Menu } from '@nrwl/nx-dev/data-access-menu';
import {
  DocumentData,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';

import Sidebar from './sidebar';
import Toc from './toc';

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
            <div className="w-full flex">
              <Content
                data={document.content}
                flavor={flavor.value}
                version={version.path}
              />
              <div className="hidden xl:text-sm xl:block flex-none w-64 pl-8 mr-8">
                <div className="flex flex-col justify-between overflow-y-auto sticky max-h-(screen-18) pt-10 pb-6 top-18">
                  <Toc />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default DocViewer;
