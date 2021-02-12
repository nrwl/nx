import * as React from 'react';
import {
  getDocument,
  getAllDocumentsPaths,
  DocumentData,
  getVersions,
  VersionData,
} from '@nrwl/nx-dev/data-access-documents';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';

interface DocumentationProps {
  document: DocumentData;
  versions: VersionData[];
}

interface DocumentationParams {
  params: { version: string; flavor: string; segments: string | string[] };
}

export function Documentation(props: DocumentationProps) {
  return (
    <DocViewer content={props.document.content} sidebar={null} toc={null} />
  );
}

export async function getStaticProps({ params }: DocumentationParams) {
  return {
    props: {
      versions: getVersions(),
      document: getDocument(params.version, [
        params.flavor,
        ...params.segments,
      ]),
    },
  };
}

export async function getStaticPaths(props) {
  const versions = ['preview'].concat(getVersions().map((x) => x.id));

  const allPaths = versions.reduce((acc, v) => {
    acc.push(...getAllDocumentsPaths(v));
    return acc;
  }, []);

  return {
    paths: allPaths,
    fallback: false,
  };
}

export default Documentation;
