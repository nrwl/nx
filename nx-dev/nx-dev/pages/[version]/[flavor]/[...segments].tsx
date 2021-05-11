import * as React from 'react';
import {
  DocumentData,
  flavorList,
  getDocument,
  getStaticDocumentPaths,
  getVersions,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { getMenu, Menu } from '@nrwl/nx-dev/data-access-menu';

interface DocumentationProps {
  version: VersionMetadata;
  flavor: { label: string; value: string };
  flavors: { label: string; value: string }[];
  document: DocumentData;
  versions: VersionMetadata[];
  menu: Menu;
}

interface DocumentationParams {
  params: { version: string; flavor: string; segments: string | string[] };
}

export function Documentation({
  document,
  menu,
  version,
  versions,
  flavor,
  flavors,
}: DocumentationProps) {
  return (
    <DocViewer
      version={version}
      versionList={versions}
      flavor={flavor}
      flavorList={flavors}
      document={document}
      menu={menu}
      toc={null}
    />
  );
}

export async function getStaticProps({ params }: DocumentationParams) {
  const versions = getVersions();
  return {
    props: {
      version:
        versions.find((item) => item.id === params.version) ||
        ({
          name: 'Preview',
          id: 'preview',
          path: 'preview',
        } as VersionMetadata),
      flavor: flavorList.find((item) => item.value === params.flavor) || {
        label: 'React',
        value: 'react',
      },
      flavors: flavorList,
      versions: versions,
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
