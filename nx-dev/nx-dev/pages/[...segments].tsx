import {
  PackageSchemaList,
  PackageSchemaViewer,
} from '@nrwl/nx-dev-feature-package-schema-viewer';
import { sortCorePackagesFirst } from '@nrwl/nx-dev/data-access-packages';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import { DocumentData } from '@nrwl/nx-dev/models-document';
import { Menu, MenuItem } from '@nrwl/nx-dev/models-menu';
import { PackageMetadata } from '@nrwl/nx-dev/models-package';
import { DocumentationHeader } from '@nrwl/nx-dev/ui-common';
import type { GetStaticPaths, GetStaticProps } from 'next';
import {
  nxCloudDocumentsApi,
  nxCloudMenuApi,
  nxDocumentsApi,
  nxMenuApi,
  packagesApi,
} from '../lib/api';
import { useNavToggle } from '../lib/navigation-toggle.effect';
import { FourOhFour } from './404';

type DocumentationPageProps =
  | { statusCode: 404 }
  | {
      statusCode: 200;
      menu: Menu;
      document: DocumentData | null;
      pkg: PackageMetadata | null;
      schemaRequest: {
        type: 'executors' | 'generators';
        schemaName: string;
      } | null;
    };

export default function DocumentationPage(
  props: DocumentationPageProps
): JSX.Element {
  const { toggleNav, navIsOpen } = useNavToggle();

  if (props.statusCode === 404) {
    return <FourOhFour />;
  }

  const { menu, document, pkg, schemaRequest } = props;

  const vm: { entryComponent: JSX.Element } = {
    entryComponent: (
      <DocViewer
        document={document || ({} as any)}
        menu={{
          sections: menu.sections.filter((x) => x.id !== 'official-packages'),
        }}
        toc={null}
        navIsOpen={navIsOpen}
      />
    ),
  };
  if (!!pkg) {
    vm.entryComponent = (
      <PackageSchemaList
        navIsOpen={navIsOpen}
        menu={{
          sections: sortCorePackagesFirst<MenuItem>(
            menu.sections.filter((x) => x.id === 'official-packages')[0]
              ?.itemList
          ),
        }}
        pkg={pkg}
      />
    );
  }

  if (!!pkg && !!schemaRequest) {
    vm.entryComponent = (
      <PackageSchemaViewer
        navIsOpen={navIsOpen}
        menu={{
          sections: sortCorePackagesFirst<MenuItem>(
            menu.sections.filter((x) => x.id === 'official-packages')[0]
              ?.itemList
          ),
        }}
        schemaRequest={{
          ...schemaRequest,
          pkg,
        }}
      />
    );
  }

  return (
    <>
      <div id="shell" className="flex h-full flex-col">
        <div className="w-full flex-shrink-0">
          <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
        </div>
        <main
          id="main"
          role="main"
          className="flex h-full flex-1 overflow-y-hidden"
        >
          {vm.entryComponent}
        </main>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async ({
  params,
}: {
  params: { segments: string[] };
}) => {
  // Set Document and Menu apis
  let documentsApi = nxDocumentsApi;
  let menuApi = nxMenuApi;
  if (params.segments[0] === 'nx-cloud') {
    documentsApi = nxCloudDocumentsApi;
    menuApi = nxCloudMenuApi;
  }

  const menu = menuApi.getMenu();

  if (params.segments[0] === 'packages') {
    let pkg: PackageMetadata | null = null;
    try {
      pkg = packagesApi.getPackage(params.segments[1]);
    } catch (e) {
      // Do nothing
    }

    // TODO@ben: handle packages view routes?
    if (!pkg || (params.segments.length < 4 && 2 < params.segments.length)) {
      return {
        notFound: true,
        props: {
          statusCode: 404,
        },
      };
    }

    // TODO@ben: handle packages view routes?
    if (pkg && params.segments.length === 2) {
      return {
        props: {
          document: null,
          menu: nxMenuApi.getMenu(),
          pkg,
          schemaRequest: null,
        },
      };
    }

    return {
      props: {
        document: null,
        menu: nxMenuApi.getMenu(),
        pkg,
        schemaRequest: {
          type: params.segments[2],
          schemaName: params.segments[3],
        },
      },
    };
  }

  let document: DocumentData | null = null;
  try {
    document = documentsApi.getDocument(params.segments);
  } catch (e) {
    // Do nothing
  }
  try {
    if (!document) document = documentsApi.getDocumentIndex(params.segments);
  } catch (e) {
    // Do nothing
  }

  if (document) {
    return {
      props: {
        document,
        menu,
        schemaRequest: null,
      },
    };
  }

  return {
    notFound: true,
    props: {
      statusCode: 404,
    },
  };
};

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [
      ...packagesApi.getStaticPackagePaths(),
      ...nxDocumentsApi.getStaticDocumentPaths(),
      ...nxCloudDocumentsApi.getStaticDocumentPaths(),
    ],
    fallback: 'blocking',
  };
};
