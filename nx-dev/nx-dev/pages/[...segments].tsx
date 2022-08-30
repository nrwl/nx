import {
  PackageSchemaList,
  PackageSchemaViewer,
} from '@nrwl/nx-dev-feature-package-schema-viewer';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { DocumentData } from '@nrwl/nx-dev/models-document';
import { Menu } from '@nrwl/nx-dev/models-menu';
import { PackageMetadata } from '@nrwl/nx-dev/models-package';
import { Footer, Header } from '@nrwl/nx-dev/ui-common';
import cx from 'classnames';
import Router from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import {
  nxCloudDocumentsApi,
  nxCloudMenuApi,
  nxDocumentsApi,
  nxMenuApi,
  packagesApi,
} from '../lib/api';

interface DocumentationPageProps {
  message?: string;
  menu?: Menu;
  document?: DocumentData | null;
  pkg?: PackageMetadata | null;
  schemaRequest?: {
    type: 'executors' | 'generators';
    schemaName: string;
  } | null;
}

export default function DocumentationPage({
  menu,
  document,
  pkg,
  message,
  schemaRequest,
}: DocumentationPageProps): JSX.Element {
  return <h1>msg: {message}</h1>;
}

export async function getStaticProps({
  params,
}: {
  params: { segments: string[] };
}) {
  // Set Document and Menu apis
  let documentsApi = nxDocumentsApi;
  // let menuApi = nxMenuApi;
  //
  // if (params.segments[0] === 'nx-cloud') {
  //   documentsApi = nxCloudDocumentsApi;
  //   menuApi = nxCloudMenuApi;
  // }
  //
  // let menu: any;
  // try {
  //   menu = menuApi.getMenu();
  // } catch {
  //   return { props: { message: 'menuApi.getMenu() (1)' } };
  // }
  //
  // if (params.segments[0] === 'packages') {
  //   let pkg: PackageMetadata | null = null;
  //   try {
  //     pkg = packagesApi.getPackage(params.segments[1]);
  //   } catch (e) {
  //     // Do nothing
  //     return { props: { message: 'packagesApi.getPackage() (2)' } };
  //   }
  //
  //   // TODO@ben: handle packages view routes?
  //   if (!pkg || (params.segments.length < 4 && 2 < params.segments.length)) {
  //     return {
  //       redirect: {
  //         // If the menu is found, go to the first document, else go to homepage
  //         destination: '/',
  //         // menu?.sections[0].itemList?.[0].itemList?.[0].path ?? '/',
  //         permanent: false,
  //       },
  //     };
  //   }
  //
  //   // TODO@ben: handle packages view routes?
  //   if (pkg && params.segments.length === 2) {
  //     return {
  //       props: {
  //         document: null,
  //         menu: nxMenuApi.getMenu(),
  //         pkg,
  //         schemaRequest: null,
  //       },
  //     };
  //   }
  //
  //   try {
  //     return {
  //       props: {
  //         document: null,
  //         menu: nxMenuApi.getMenu(),
  //         pkg,
  //         schemaRequest: {
  //           type: params.segments[2],
  //           schemaName: params.segments[3],
  //         },
  //       },
  //     };
  //   } catch (e) {
  //     return { props: { message: `nxMenuApi.getMenu() (3) ${e.message}` } };
  //   }
  // }

  let document: DocumentData | undefined;
  try {
    document = documentsApi.getDocument(params.segments);
  } catch (e) {
    // Do nothing
    return {
      // props: { message: 'documentsApi.getDocument() (4)' } };
      redirect: {
        destination: '/#error',
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      // If the menu is found, go to the first document, else go to homepage
      destination: '/',
      //menu?.sections[0].itemList?.[0].itemList?.[0].path ?? '/',
      permanent: false,
    },
  };
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}
//   return {
//     paths: [
//       ...packagesApi.getStaticPackagePaths(),
//       ...nxDocumentsApi.getStaticDocumentPaths(),
//       ...nxCloudDocumentsApi.getStaticDocumentPaths(),
//     ],
//     fallback: 'blocking',
//   };
// }
