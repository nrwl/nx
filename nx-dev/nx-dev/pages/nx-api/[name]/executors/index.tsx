import { getPackagesSections } from '@nx/nx-dev/data-access-menu';
import { sortCorePackagesFirst } from '@nx/nx-dev/data-access-packages';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import { ProcessedPackageMetadata } from '@nx/nx-dev/models-package';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticPaths } from 'next';
import { PackageSchemaSubList } from '@nx/nx-dev/feature-package-schema-viewer/src/lib/package-schema-sub-list';
import { menusApi } from '../../../../lib/menus.api';
import { useNavToggle } from '../../../../lib/navigation-toggle.effect';
import { nxPackagesApi } from '../../../../lib/packages.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';

export default function ExecutorsIndex({
  menu,
  pkg,
}: {
  menu: MenuItem[];
  pkg: ProcessedPackageMetadata;
}): JSX.Element {
  const { toggleNav, navIsOpen } = useNavToggle();

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
        <SidebarContainer
          menu={vm.menu}
          navIsOpen={navIsOpen}
          toggleNav={toggleNav}
        />
        <ScrollableContent resetScrollOnNavigation={true}>
          <PackageSchemaSubList pkg={vm.package} type={'executor'} />
        </ScrollableContent>
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

export async function getStaticProps({
  params,
}: {
  params: { name: string };
}): Promise<{
  props: {
    menu: MenuItem[];
    pkg: ProcessedPackageMetadata;
  };
}> {
  const pkg = nxPackagesApi.getPackage([params.name]);
  return {
    props: {
      menu: menusApi.getMenu('nx-api', 'nx-api'),
      pkg,
    },
  };
}
