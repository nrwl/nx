import {
  DocumentData,
  DocumentMapItem,
  getArchivedVersions,
  getDocument,
  getDocumentsByFlavor,
  getStaticDocumentPaths,
  VersionEntry,
} from '@nrwl/nx-dev/data-access-documents';
import { DocViewer, Sidebar, Toc } from '@nrwl/nx-dev/feature-doc-viewer';
import cx from 'classnames';

interface DocumentationProps {
  document: DocumentData;
  documentMap: DocumentMapItem[];
  versions: VersionEntry[];
}

interface DocumentationParams {
  params: { version: string; flavor: string; segments: string | string[] };
}

export function DocumentationPage({
  documentMap,
  document,
}: DocumentationProps) {
  return (
    <div className="w-full max-w-screen-xl max-w-8xl mx-auto">
      <div className="lg:flex">
        <div
          id="sidebar"
          className="fixed z-40 inset-0 flex-none h-full bg-black bg-opacity-25 w-full lg:bg-white lg:static lg:h-auto lg:overflow-y-visible lg:pt-o lg:w-60 xl:w-72 lg:block hidden"
        >
          <div
            id="navigation-wrapper"
            className={cx(
              'bg-white h-full scrolling-touch overflow-y-auto bg-white mr-24 pt-16 pb-10 px-1 mr-24 ',
              'sticky?lg:h-(screen-18)',
              'lg:h-auto lg:block lg:relative lg:sticky lg:bg-transparent lg:mr-0 lg:top-18 lg:text-sm lg:pt-10 lg:pb-14 lg:h-auto lg:block lg:relative lg:sticky lg:bg-transparent lg:top-18 lg:mr-0',
              'sm:px-3 xl:px-5'
            )}
          >
            <div className="hidden lg:block h-12 pointer-events-none absolute inset-x-0 z-10 bg-gradient-to-b from-white"></div>
            <Sidebar map={documentMap} />
          </div>
        </div>
        <div className="min-w-0 w-full flex-auto lg:static lg:max-h-full lg:overflow-visible">
          <div className="w-full flex">
            <div className="min-w-0 flex-auto px-4 sm:px-6 xl:px-8 pt-10 pb-24 lg:pb-16">
              <DocViewer content={document.content} />
            </div>
            <div className="hidden xl:text-sm xl:block flex-none w-64 pl-8 mr-8">
              <div className="flex flex-col justify-between overflow-y-auto sticky max-h-(screen-18) pt-10 pb-6 top-18">
                <Toc />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function getStaticProps({ params }: DocumentationParams) {
  return {
    props: {
      versions: getArchivedVersions(),
      documentMap: getDocumentsByFlavor(params.version, params.flavor),
      document: getDocument(params.version, [
        params.flavor,
        ...params.segments,
      ]),
    },
  };
}

export async function getStaticPaths(props) {
  const versions = ['preview'].concat(getArchivedVersions().map((x) => x.id));

  const allPaths = versions.reduce((acc, v) => {
    acc.push(...getStaticDocumentPaths(v));
    return acc;
  }, []);

  return {
    paths: allPaths,
    fallback: false,
  };
}

export default DocumentationPage;
