import { getBasicNxSection } from '@nx/nx-dev/data-access-menu';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
import { PackageSchemaSubList } from '@nx/nx-dev/feature-package-schema-viewer/src/lib/package-schema-sub-list';
import { ProcessedDocument, RelatedDocument } from '@nx/nx-dev/models-document';
import { MenuItem } from '@nx/nx-dev/models-menu';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticPaths, GetStaticProps } from 'next';
import { menusApi } from '../lib/menus.api';
import { useNavToggle } from '../lib/navigation-toggle.effect';
import { nxDocumentationApi } from '../lib/nx.api';
import { nxPackagesApi } from '../lib/packages.api';
import { tagsApi } from '../lib/tags.api';
import { fetchGithubStarCount } from '../lib/githubStars.api';
import { ScrollableContent } from '@nx/ui-scrollable-content';
import {
  PackageSchemaList,
  PackageSchemaViewer,
} from '@nx/nx-dev/feature-package-schema-viewer';
import {
  type MigrationMetadata,
  type ProcessedPackageMetadata,
  type SchemaMetadata,
} from '@nx/nx-dev/models-package';

type NxDocumentationProps =
  | {
      pageType: 'document';
      menu: MenuItem[];
      document: ProcessedDocument;
      relatedDocuments: RelatedDocument[];
      widgetData: { githubStarsCount: number };
    }
  | {
      pageType: 'api-index';
      menu: MenuItem[];
      pkg: ProcessedPackageMetadata;
      migrations: MigrationMetadata[];
    }
  | {
      pageType: 'migrations';
      menu: MenuItem[];
      pkg: ProcessedPackageMetadata;
      migrations: MigrationMetadata[];
    }
  | {
      pageType:
        | 'generators-index'
        | 'executors-index'
        | 'generators'
        | 'executors';
      menu: MenuItem[];
      pkg: ProcessedPackageMetadata;
      schema?: SchemaMetadata;
    };

export default function NxDocumentation(props: NxDocumentationProps) {
  const { toggleNav, navIsOpen } = useNavToggle();

  const menuWithSections = {
    sections: [getBasicNxSection(props.menu)],
  };

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
          menu={menuWithSections}
          toggleNav={toggleNav}
          navIsOpen={navIsOpen}
        />
        <ScrollableContent resetScrollOnNavigation={true}>
          {props.pageType === 'document' ? (
            <DocViewer
              document={props.document}
              relatedDocuments={props.relatedDocuments}
              widgetData={props.widgetData}
            />
          ) : props.pageType === 'api-index' ? (
            <PackageSchemaList
              pkg={props.pkg}
              overview={''}
              migrations={props.migrations}
            />
          ) : props.pageType === 'migrations' ? (
            <PackageSchemaSubList
              pkg={props.pkg}
              migrations={props.migrations}
              type={'migration'}
            />
          ) : props.pageType === 'generators-index' ? (
            <PackageSchemaSubList pkg={props.pkg} type="generator" />
          ) : props.pageType === 'executors-index' ? (
            <PackageSchemaSubList pkg={props.pkg} type="executor" />
          ) : (
            <PackageSchemaViewer pkg={props.pkg} schema={props.schema} />
          )}
        </ScrollableContent>
      </main>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = () => {
  const reservedPaths = ['/ci', '/changelog'];
  return {
    paths: nxDocumentationApi
      .getSlugsStaticDocumentPaths()
      .filter(
        (path) => !reservedPaths.some((reserved) => path.startsWith(reserved))
      ),
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps = async ({
  params,
}: {
  params: { segments: string[] };
}): Promise<any> => {
  try {
    if (params.segments[0] === 'technologies' && params.segments[2] === 'api') {
      const [, packageName, , type, ...segments] = params.segments;
      if (!type) {
        // API index
        // Example: /technologies/typescript/api
        const pkg = nxPackagesApi.getPackage([packageName]);
        return {
          props: {
            pageType: 'api-index',
            pkg,
            menu: menusApi.getMenu('nx', ''),
            migrations: Object.keys(pkg.migrations).map((migration) => {
              return nxPackagesApi.getSchemaMetadata(
                nxPackagesApi.getPackageFileMetadatas(pkg.name, 'migrations')[
                  migration
                ]
              ) as MigrationMetadata;
            }),
          },
        };
      } else if (type === 'generators' || type === 'executors') {
        // API generators and executors
        // Examples:
        // - /technologies/typescript/api/generators
        // - /technologies/typescript/api/generators/library
        const isList = segments.length === 0;
        const props: NxDocumentationProps = {
          // e.g. generators vs generators-list
          pageType: isList ? `${type}-index` : type,
          pkg: nxPackagesApi.getPackage([packageName]),
          menu: menusApi.getMenu('nx', ''),
        };
        if (!isList) {
          props.schema = nxPackagesApi.getSchemaMetadata(
            nxPackagesApi.getPackageFileMetadatas(packageName, type)[
              '/' + ['nx-api', packageName, type, ...segments].join('/')
            ]
          );
        }
        return { props };
      } else if (type === 'migrations') {
        // API migrations
        // Example: /technologies/typescript/api/migrations
        return {
          props: {
            pageType: type,
            menu: menusApi.getMenu('nx', ''),
            pkg: nxPackagesApi.getPackage([packageName]),
            migrations: Object.keys(
              nxPackagesApi.getPackage([packageName]).migrations
            ).map((migration) => {
              return nxPackagesApi.getSchemaMetadata(
                nxPackagesApi.getPackageFileMetadatas(
                  nxPackagesApi.getPackage([packageName]).name,
                  'migrations'
                )[migration]
              ) as MigrationMetadata;
            }),
          },
        };
      }
    } else {
      // Other documentation pages (e.g. markdown files in the docs folder)
      // Example: /features/run-tasks
      const document = nxDocumentationApi.getDocument(params.segments);
      return {
        props: {
          pageType: 'document',
          document,
          widgetData: {
            githubStarsCount: await fetchGithubStarCount(),
          },
          relatedDocuments: tagsApi
            .getAssociatedItemsFromTags(document.tags)
            .filter((item) => item.path !== '/' + params.segments.join('/')), // Remove currently displayed item
          menu: menusApi.getMenu('nx', ''),
        },
      };
    }
  } catch {
    // nothing
  }
  return {
    notFound: true,
    props: {
      statusCode: 404,
    },
  };
};
