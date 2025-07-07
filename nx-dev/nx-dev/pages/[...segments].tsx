import { getBasicNxSection } from '@nx/nx-dev/data-access-menu';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
import { PackageSchemaSubList } from '@nx/nx-dev/feature-package-schema-viewer/src/lib/package-schema-sub-list';
import {
  pkgToGeneratedApiDocs,
  ProcessedDocument,
  RelatedDocument,
} from '@nx/nx-dev/models-document';
import { MenuItem } from '@nx/nx-dev/models-menu';
import { DocumentationHeader, SidebarContainer } from '@nx/nx-dev/ui-common';
import { GetStaticPaths, GetStaticProps } from 'next';
import { menusApi } from '../lib/menus.api';
import { useNavToggle } from '../lib/navigation-toggle.effect';
import { nxDocumentationApi } from '../lib/nx.api';
import { nxNewPackagesApi } from '../lib/new-packages.api';
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
import { DocumentsApi } from '@nx/nx-dev/data-access-documents/node-only';

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
        | 'legacy-documents-index'
        | 'executors-index'
        | 'generators'
        | 'executors';
      menu: MenuItem[];
      pkg: ProcessedPackageMetadata;
      schema?: SchemaMetadata;
    }
  | {
      pageType: 'legacy-documents';
      document: ProcessedDocument;
      menu: MenuItem[];
      pkg: ProcessedPackageMetadata;
      relatedDocuments: RelatedDocument[];
      widgetData: { githubStarsCount: number };
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
          ) : props.pageType === 'legacy-documents-index' ? (
            <PackageSchemaSubList pkg={props.pkg} type="document" />
          ) : props.pageType === 'legacy-documents' ? (
            <DocViewer
              document={props.document}
              relatedDocuments={props.relatedDocuments}
              widgetData={props.widgetData}
            />
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

// reverse key-value pair so we can map URL segments back to package names
const apiPagePathToPkg = Object.entries(pkgToGeneratedApiDocs).reduce(
  (acc, [k, v]) => {
    acc[v.pagePath] = k;
    return acc;
  },
  {} as Record<string, string>
);

function findPackage(path: string): string | null {
  for (const [k, v] of Object.entries(apiPagePathToPkg)) {
    if (`/${path}`.startsWith(k)) return v;
  }
  return null;
}

export const getStaticProps: GetStaticProps = async ({
  params,
}: {
  params: { segments: string[] };
}): Promise<any> => {
  const menu = menusApi.getMenu('nx', '');
  const fullPath = params.segments.join('/');
  const packageName = findPackage(fullPath);
  /*
   * This function handles a few cases:
   * 1. API docs - generators
   * 2. API docs - executors
   * 3. API docs - migrations
   * 4. API docs - legacy documents (we should be moving these to recipes/guides)
   * 5. Markdown docs - non-generated documents in `docs/` folder
   */
  try {
    if (packageName) {
      const segments = params.segments;
      const prefix = pkgToGeneratedApiDocs[packageName].pagePath.replace(
        /^\//,
        ''
      );
      const remainingPath = fullPath.replace(new RegExp(`^${prefix}/`), '');

      const [type, ...rest] = remainingPath.split('/');
      if (remainingPath === fullPath) {
        // API index
        // Example: /technologies/typescript/api
        const pkg = nxNewPackagesApi.getPackage([packageName]);
        return {
          props: {
            pageType: 'api-index',
            pkg,
            menu,
            migrations: Object.keys(pkg.migrations).map((migration) => {
              return nxNewPackagesApi.getSchemaMetadata(
                nxNewPackagesApi.getPackageFileMetadatas(
                  pkg.name,
                  'migrations'
                )[migration]
              ) as MigrationMetadata;
            }),
          },
        };
      } else if (type === 'generators' || type === 'executors') {
        // API generators and executors
        // Examples:
        // - /technologies/typescript/api/generators
        // - /technologies/typescript/api/generators/library
        const isList = rest.length === 0;
        const props: NxDocumentationProps = {
          // e.g. generators vs generators-list
          pageType: isList ? `${type}-index` : type,
          pkg: nxNewPackagesApi.getPackage([packageName]),
          menu,
        };
        if (!isList) {
          props.schema = nxNewPackagesApi.getSchemaMetadata(
            nxNewPackagesApi.getPackageFileMetadatas(packageName, type)[
              '/' + segments.join('/')
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
            pkg: nxNewPackagesApi.getPackage([packageName]),
            migrations: Object.keys(
              nxNewPackagesApi.getPackage([packageName]).migrations
            ).map((migration) => {
              return nxNewPackagesApi.getSchemaMetadata(
                nxNewPackagesApi.getPackageFileMetadatas(
                  nxNewPackagesApi.getPackage([packageName]).name,
                  'migrations'
                )[migration]
              ) as MigrationMetadata;
            }),
          },
        };
      } else if (type === 'documents') {
        const isList = rest.length === 0;
        if (isList) {
          return {
            props: {
              pageType: 'legacy-documents-index',
              pkg: nxNewPackagesApi.getPackage([packageName]),
              menu,
            },
          };
        } else {
          const documents = new DocumentsApi({
            id: [packageName, 'documents'].join('-'),
            manifest: nxNewPackagesApi.getPackageDocuments(packageName),
            prefix: '',
            publicDocsRoot: 'public/documentation',
            tagsApi,
          });
          const document = documents.getDocument(segments);
          return {
            props: {
              pageType: 'legacy-documents',
              pkg: nxNewPackagesApi.getPackage([packageName]),
              document,
              widgetData: {
                githubStarsCount: await fetchGithubStarCount(),
              },
              relatedDocuments: tagsApi
                .getAssociatedItemsFromTags(document.tags)
                .filter((item) => item.path !== '/' + segments.join('/')), // Remove currently displayed item
              menu,
            },
          };
        }
      }
    }
    // Fallback to regular documentation
    const document = nxDocumentationApi.getDocument(params.segments);
    return {
      props: {
        pageType: 'document',
        document,
        widgetData: {
          githubStarsCount: await fetchGithubStarCount(),
        },
        menu,
        relatedDocuments: tagsApi
          .getAssociatedItemsFromTags(document.tags)
          .filter((item) => item.path !== '/' + params.segments.join('/')), // Remove currently displayed item
      },
    };
  } catch (e) {
    return {
      notFound: true,
      props: {
        statusCode: 404,
      },
    };
  }
};
