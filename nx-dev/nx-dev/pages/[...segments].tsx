import { getBasicNxSection } from '@nx/nx-dev/data-access-menu';
import { DocViewer } from '@nx/nx-dev/feature-doc-viewer';
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
import { PackageSchemaViewer } from '@nx/nx-dev/feature-package-schema-viewer';
import {
  type SchemaMetadata,
  type ProcessedPackageMetadata,
} from '@nx/nx-dev/models-package';

type NxDocumentationProps =
  | {
      isApiDoc: false;
      menu: MenuItem[];
      document: ProcessedDocument;
      relatedDocuments: RelatedDocument[];
      widgetData: { githubStarsCount: number };
    }
  | {
      isApiDoc: true;
      menu: MenuItem[];
      pkg: ProcessedPackageMetadata;
      schema: SchemaMetadata;
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
          {props.isApiDoc === false ? (
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
export const getStaticProps: GetStaticProps = async ({
  params,
}: {
  params: { segments: string[] };
}): Promise<any> => {
  try {
    if (params.segments[0] === 'technologies' && params.segments[2] === 'api') {
      const [, packageName, , type, ...segments] = params.segments;
      if (
        type === 'generators' ||
        type === 'executors' ||
        type === 'migrations'
      ) {
        return {
          props: {
            isApiDoc: true,
            pkg: nxPackagesApi.getPackage([packageName]),
            schema: nxPackagesApi.getSchemaMetadata(
              nxPackagesApi.getPackageFileMetadatas(packageName, type)[
                '/' + ['nx-api', packageName, type, ...segments].join('/')
              ]
            ),
            menu: menusApi.getMenu('nx', ''),
          },
        };
      }
    } else {
      const document = nxDocumentationApi.getDocument(params.segments);
      return {
        props: {
          isApiDoc: false,
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
  } catch (e) {
    // nothing
  }
  return {
    notFound: true,
    props: {
      statusCode: 404,
    },
  };
};
