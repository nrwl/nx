import * as React from 'react';
import {
  getDocument,
  getStaticDocumentPaths,
  DocumentData,
  getVersions,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { getMenu, Menu } from '@nrwl/nx-dev/data-access-menu';

interface DocumentationProps {
  document: DocumentData;
  versions: VersionMetadata[];
  menu: Menu;
}

interface DocumentationParams {
  params: { version: string; flavor: string; segments: string | string[] };
}

export function Documentation({ document, menu }: DocumentationProps) {
  return <DocViewer content={document.content} menu={menu} toc={null} />;
}

export async function getStaticProps({ params }: DocumentationParams) {
  return {
    props: {
      versions: getVersions(),
      document: getDocument(params.version, [
        params.flavor,
        ...params.segments,
      ]),
      menu: getMenu(params.version, params.flavor),
    },
  };
}

export async function getStaticPaths(props) {
  const versions = ['preview'].concat(getVersions().map((x) => x.id));

  const allPaths = versions.reduce((acc, v) => {
    acc.push(...getStaticDocumentPaths(v));
    return acc;
  }, []);

  return {
    paths: allPaths,
    fallback: false,
  };
}

export default Documentation;
