import { readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import * as marked from 'marked';
import { archiveRootPath, previewRootPath } from './documents.utils';
import {
  DocumentData,
  DocumentMapItem,
  ArchiveVersionData,
} from './documents.models';
import { readJsonFile } from '@nrwl/workspace';

export function getDocument(
  version: string,
  _segments: string | string[]
): DocumentData {
  const segments = Array.isArray(_segments) ? [..._segments] : [_segments];
  const docPath = getFilePath(version, segments);
  const file = matter(readFileSync(docPath, 'utf8'));

  return {
    filePath: docPath,
    data: file.data,
    content: marked.parse(file.content),
    excerpt: file.excerpt,
  };
}

const mapCache = new Map<string, DocumentMapItem[]>();
export function getDocuments(version: string) {
  try {
    let list = mapCache.get(version);
    if (!list) {
      list = readJsonFile(join(getDocumentsRoot(version), 'map.json'));
      mapCache.set(version, list);
    }
    return list;
  } catch {
    throw new Error(`Cannot find map.json for ${version}`);
  }
}

export function getFilePath(version: string, segments: string[]): string {
  let items = getDocuments(version);
  let found;
  for (const segment of segments) {
    found = items.find((item) => item.id === segment);
    if (found) {
      items = found.itemList;
    } else {
      throw new Error(
        `Cannot find document matching segments: ${segments.join(',')}`
      );
    }
  }
  if (!found.file) {
    throw new Error(
      `Cannot find document matching segments: ${segments.join(',')}`
    );
  }
  return join(getDocumentsRoot(version), `${found.file}.md`);
}

export function getStaticDocumentPaths(version: string) {
  const paths = [];

  function recur(curr, acc) {
    if (curr.file) {
      paths.push({
        params: {
          version,
          flavor: acc[0],
          segments: acc.slice(2).concat(curr.id),
        },
      });
      return;
    }
    if (curr.itemList) {
      curr.itemList.forEach((ii) => {
        recur(ii, [...acc, curr.id]);
      });
    }
  }

  getDocuments(version).forEach((item) => {
    recur(item, [item.id]);
  });

  return paths;
}

const versionsData = readJsonFile(join(archiveRootPath, 'versions.json'));
export function getDocumentsRoot(version: string): string {
  if (version === 'preview') {
    return previewRootPath;
  }

  if (version === 'latest' || version === 'previous') {
    return join(
      archiveRootPath,
      versionsData.find((x) => x.id === version).path
    );
  }

  throw new Error(`Cannot find root for ${version}`);
}

let versions: ArchiveVersionData[];
export function getVersions(): ArchiveVersionData[] {
  if (!versions) {
    versions = readJsonFile(join(archiveRootPath, 'versions.json'));
  }
  return versions;
}
