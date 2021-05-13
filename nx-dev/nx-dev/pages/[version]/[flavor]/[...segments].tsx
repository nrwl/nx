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
  versions: VersionMetadata[];
  menu: Menu;
  document?: DocumentData;
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

const defaultVersion = {
  name: 'Preview',
  id: 'preview',
  path: 'preview',
} as VersionMetadata;

const defaultFlavor = {
  label: 'React',
  value: 'react',
};

export async function getStaticProps({ params }: DocumentationParams) {
  let versions: VersionMetadata[];
  let version: VersionMetadata;
  let flavor: { label: string; value: string };
  let menu: Menu;
  let document: DocumentData;

  /*
   * Try to find the document matching segments. If the document isn't found, then:
   *
   * - Try to get menu for current flavor+version, if found then redirect to first page in menu.
   * - Otherwise, redirect to the root.
   */
  try {
    versions = getVersions();
    version =
      versions.find((item) => item.id === params.version) || defaultVersion;
    flavor =
      flavorList.find((item) => item.value === params.flavor) || defaultFlavor;
    menu = getMenu(params.version, params.flavor);
    document = getDocument(params.version, [params.flavor, ...params.segments]);

    return {
      props: {
        version,
        flavor,
        flavors: flavorList,
        versions: versions,
        menu,
        document,
      },
    };
  } catch {
    const firstPagePath = menu?.sections[0].itemList?.[0].itemList?.[0].path;
    return {
      redirect: {
        destination: firstPagePath ?? '/',
        permanent: false,
      },
    };
  }
}

export async function getStaticPaths(props) {
  const versions = ['preview'].concat(getVersions().map((x) => x.id));

  const allPaths = versions.reduce((acc, v) => {
    acc.push(...getStaticDocumentPaths(v));
    return acc;
  }, []);

  return {
    paths: allPaths,
    /*
     * Block rendering until the page component resolves with either:
     * 1. The content of the document if it exists.
     * 2. A redirect to another page if document is not found.
     */
    fallback: 'blocking',
  };
}

export default Documentation;
