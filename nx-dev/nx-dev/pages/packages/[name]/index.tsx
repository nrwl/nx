import { PackageSchemaList } from '@nx/nx-dev/feature-package-schema-viewer';
import { DocumentsApi } from '@nx/nx-dev/data-access-documents/node-only';
import { getPackagesSections } from '@nx/nx-dev/data-access-menu';
import { sortCorePackagesFirst } from '@nx/nx-dev/data-access-packages';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import { ProcessedPackageMetadata } from '@nx/nx-dev/models-package';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticPaths } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { menusApi } from '../../../lib/menus.api';
import { useNavToggle } from '../../../lib/navigation-toggle.effect';
import { nxPackagesApi } from '../../../lib/packages.api';
import { tagsApi } from '../../../lib/tags.api';

export default function Package({
  overview,
  menu,
  pkg,
}: {
  menu: MenuItem[];
  overview: string;
  pkg: ProcessedPackageMetadata;
}): JSX.Element {
  const router = useRouter();
  const { toggleNav, navIsOpen } = useNavToggle();
  const wrapperElement = useRef(null);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (url.includes('#')) return;
      if (!wrapperElement) return;

      (wrapperElement as any).current.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router, wrapperElement]);

  const vm: { menu: Menu; package: ProcessedPackageMetadata } = {
    menu: {
      sections: sortCorePackagesFirst<MenuSection>(
        getPackagesSections(menu),
        'id'
      ),
    },
    package: pkg,
  };

  /**
   * Show either the docviewer or the package view depending on:
   * - docviewer: it is a documentation document
   * - packageviewer: it is package generated documentation
   */

  return (
    <div id="shell" className="flex h-full flex-col">
      <div className="w-full flex-shrink-0">
        <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
      </div>
      <main
        id="main"
        role="main"
        className="flex h-full flex-1 overflow-y-hidden"
      >
        <SidebarContainer menu={vm.menu} navIsOpen={navIsOpen} />
        <div
          ref={wrapperElement}
          id="wrapper"
          data-testid="wrapper"
          className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
        >
          <PackageSchemaList pkg={vm.package} overview={overview} />
        </div>
      </main>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [
      ...nxPackagesApi.getStaticDocumentPaths().packages.map((x) => ({
        params: { name: x.params.segments.slice(1)[0] },
      })),
    ],
    fallback: 'blocking',
  };
};

function getData(packageName: string): {
  menu: MenuItem[];
  overview: string;
  pkg: ProcessedPackageMetadata;
} {
  const pkg = nxPackagesApi.getPackage([packageName]);
  const documents = new DocumentsApi({
    id: [packageName, 'documents'].join('-'),
    manifest: nxPackagesApi.getPackageDocuments(packageName),
    prefix: '',
    publicDocsRoot: 'public/documentation',
    tagsApi,
  });

  let overview = '';
  try {
    overview = documents.getDocument([
      'packages',
      packageName,
      'documents',
      'overview',
    ])['content'];
  } catch (e) {
    overview = pkg.description;
  }

  return {
    menu: menusApi.getMenu('packages', 'packages'),
    overview: overview,
    pkg,
  };
}
export async function getStaticProps({ params }: { params: { name: string } }) {
  try {
    return { props: getData(params.name) };
  } catch (e) {
    return {
      notFound: true,
      props: {
        statusCode: 404,
      },
    };
  }
}
