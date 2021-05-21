import type {
  DocumentData,
  Menu,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import { flavorList } from '@nrwl/nx-dev/data-access-documents';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';

import { documentsApi, menuApi } from '../../../lib/api';

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
    versions = documentsApi.getVersions();
    version = versions.find((item) => item.id === params.version);
    flavor =
      flavorList.find((item) => item.value === params.flavor) || defaultFlavor;
    menu = menuApi.getMenu(params.version, params.flavor);
    document = documentsApi.getDocument(params.version, [
      params.flavor,
      ...params.segments,
    ]);

    if (document && version) {
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
    }
  } catch {
    // nothing
  }

  const firstPagePath = menu?.sections[0].itemList?.[0].itemList?.[0].path;
  return {
    redirect: {
      destination: firstPagePath ?? '/',
      permanent: false,
    },
  };
}

export async function getStaticPaths() {
  const versions = documentsApi.getVersions().map((x) => x.id);

  const allPaths = versions.reduce((acc, v) => {
    acc.push(...documentsApi.getStaticDocumentPaths(v));
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
