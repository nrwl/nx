import { getPackagesSections } from '@nx/nx-dev/data-access-menu';
import { sortCorePackagesFirst } from '@nx/nx-dev/data-access-packages';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import { ProcessedPackageMetadata } from '@nx/nx-dev/models-package';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { PackageSchemaSubList } from '@nx/nx-dev/feature-package-schema-viewer/src/lib/package-schema-sub-list';
import { menusApi } from '../../../../lib/menus.api';
import { useNavToggle } from '../../../../lib/navigation-toggle.effect';
import { pkg } from '../../../../lib/rspack/pkg';

export default function GeneratorsIndex({
  menu,
  pkg,
}: {
  menu: MenuItem[];
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
          <PackageSchemaSubList pkg={vm.package} type={'generator'} />
        </div>
      </main>
    </div>
  );
}

export async function getStaticProps(): Promise<{
  props: {
    menu: MenuItem[];
    pkg: ProcessedPackageMetadata;
  };
}> {
  return {
    props: {
      menu: menusApi.getMenu('packages', 'packages'),
      pkg,
    },
  };
}
