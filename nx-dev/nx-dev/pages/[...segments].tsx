import type {
  DocumentData,
  Menu,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import { flavorList } from '@nrwl/nx-dev/data-access-documents';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { useRouter } from 'next/router';

import { documentsApi, menuApi } from '../lib/api';
import { useStorage } from '../lib/use-storage';
import { useEffect } from 'react';

const versionList = documentsApi.getVersions();
const defaultVersion = versionList[0];
const defaultFlavor = {
  label: 'React',
  value: 'react',
};

interface DocumentationProps {
  version: VersionMetadata;
  flavor: { label: string; value: string };
  flavors: { label: string; value: string }[];
  versions: VersionMetadata[];
  menu: Menu;
  document: DocumentData;
  isFallback: boolean;
}

interface DocumentationParams {
  params: { segments: string[] };
}

export function Documentation({
  document,
  menu,
  version,
  versions,
  flavor,
  flavors,
  isFallback,
}: DocumentationProps) {
  const router = useRouter();
  const { value: storedFlavor, setValue: setStoredFlavor } = useStorage(
    'flavor'
  );

  useEffect(() => {
    if (!isFallback) setStoredFlavor(flavor.value);
  }, [flavor, isFallback, setStoredFlavor]);

  useEffect(() => {
    if (!isFallback || !storedFlavor) return;

    if (flavor.value !== storedFlavor) {
      // If the stored flavor is different then navigate away.
      router.push(`/${version.id}/${storedFlavor}${router.asPath}`);
    } else if (!router.asPath.startsWith(`/${version.id}`)) {
      // Otherwise replace current URL if it is missing version+flavor.
      router.push(`/${version.id}/${storedFlavor}${router.asPath}`, undefined, {
        shallow: true,
      });
    }
  }, [router, version, flavor, storedFlavor, isFallback]);

  return (
    <>
      {/* TODO: Display message for fallback without stored flavor */}
      <DocViewer
        version={version}
        versionList={versions}
        flavor={flavor}
        flavorList={flavors}
        document={document}
        menu={menu}
        toc={null}
      />
    </>
  );
}

export async function getStaticProps({ params }: DocumentationParams) {
  const version =
    versionList.find((item) => item.id === params.segments[0]) ??
    defaultVersion;
  const flavor: { label: string; value: string } =
    flavorList.find((item) => item.value === params.segments[1]) ??
    defaultFlavor;

  const { document, menu, fallback } = findDocumentAndMenu(
    version,
    flavor,
    params.segments
  );

  if (document) {
    return {
      props: {
        version,
        flavor,
        versions: versionList,
        flavors: flavorList,
        document,
        menu,
        isFallback: fallback,
      },
    };
  } else {
    return {
      redirect: {
        // If the menu is found, go to the first document, else go to homepage
        destination: menu?.sections[0].itemList?.[0].itemList?.[0].path ?? '/',
        permanent: false,
      },
    };
  }
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

function findDocumentAndMenu(
  version,
  flavor,
  segments
): { menu?: Menu; document?: DocumentData; fallback?: boolean } {
  const fallback = segments[0] !== version.id;
  const path = fallback ? segments : segments.slice(2);

  let menu: Menu;
  let document: DocumentData;

  try {
    menu = menuApi.getMenu(version.id, flavor.value);
    document = documentsApi.getDocument(version.id, flavor.value, path);
  } catch {
    // nothing
  }

  return { document, menu, fallback };
}

export default Documentation;
