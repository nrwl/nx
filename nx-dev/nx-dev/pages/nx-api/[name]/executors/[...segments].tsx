import { PackageSchemaViewer } from '@nx/nx-dev/feature-package-schema-viewer';
import { getPackagesSections } from '@nx/nx-dev/data-access-menu';
import { sortCorePackagesFirst } from '@nx/nx-dev/data-access-packages';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import {
  ProcessedPackageMetadata,
  SchemaMetadata,
} from '@nx/nx-dev/models-package';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticPaths } from 'next';
import { menusApi } from '../../../../lib/menus.api';
import { useNavToggle } from '../../../../lib/navigation-toggle.effect';
import { nxPackagesApi } from '../../../../lib/packages.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';

export default function PackageExecutor({
  menu,
  pkg,
  schema,
}: {
  menu: MenuItem[];
  pkg: ProcessedPackageMetadata;
  schema: SchemaMetadata;
}): JSX.Element {
  const { toggleNav, navIsOpen } = useNavToggle();

  const vm: {
    menu: Menu;
    package: ProcessedPackageMetadata;
    schema: SchemaMetadata;
  } = {
    menu: {
      sections: sortCorePackagesFirst<MenuSection>(
        getPackagesSections(menu),
        'id'
      ),
    },
    package: pkg,
    schema: schema,
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
          <PackageSchemaViewer pkg={vm.package} schema={vm.schema} />
        </ScrollableContent>
      </main>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [
      ...nxPackagesApi.getStaticDocumentPaths().executors.map((x) => ({
        params: {
          name: x.params.segments.slice(1)[0],
          segments: x.params.segments.slice(3),
        },
      })),
    ],
    fallback: 'blocking',
  };
};

function getData(
  packageName: string,
  segments: string[]
): {
  pkg: ProcessedPackageMetadata;
  schema: SchemaMetadata;
  menu: MenuItem[];
} {
  return {
    pkg: nxPackagesApi.getPackage([packageName]),
    schema: nxPackagesApi.getSchemaMetadata(
      nxPackagesApi.getPackageFileMetadatas(packageName, 'executors')[
        '/' + ['nx-api', packageName, 'executors', ...segments].join('/')
      ]
    ),
    menu: menusApi.getMenu('nx-api', 'nx-api'),
  };
}

export async function getStaticProps({
  params,
}: {
  params: { name: string; segments: string[] };
}) {
  try {
    return {
      props: getData(params.name, params.segments),
    };
  } catch (e) {
    return {
      notFound: true,
      props: {
        statusCode: 404,
      },
    };
  }
}
