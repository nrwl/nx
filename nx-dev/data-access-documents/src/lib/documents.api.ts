import { readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import * as marked from 'marked';
import {
  archiveRootPath,
  extractTitle,
  previewRootPath,
} from './documents.utils';
import {
  VersionMetadata,
  DocumentData,
  DocumentMetadata,
} from './documents.models';
import { readJsonFile } from '@nrwl/workspace';

export function getDocument(
  version: string,
  _segments: string | string[]
): DocumentData {
  const segments = Array.isArray(_segments) ? [..._segments] : [_segments];
  const docPath = getFilePath(version, segments);
  const originalContent = readFileSync(docPath, 'utf8');
  const file = matter(originalContent);

  // Set default title if not provided in front-matter section.
  if (!file.data.title) {
    file.data.title =
      extractTitle(originalContent) ?? segments[segments.length - 1];
  }

  return {
    filePath: docPath,
    data: file.data,
    content: marked.parse(file.content),
    excerpt: file.excerpt,
  };
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
        `Cannot find document matching segments: ${JSON.stringify(segments)}`
      );
    }
  }
  const file = found.file ?? segments.join('/');
  return join(getDocumentsRoot(version), `${file}.md`);
}

const documentsCache = new Map<string, DocumentMetadata[]>();
export function getDocuments(version: string) {
  try {
    let list = documentsCache.get(version);
    if (!list) {
      list = readJsonFile(join(getDocumentsRoot(version), 'map.json'));
      documentsCache.set(version, list);
    }
    return list;
  } catch {
    throw new Error(`Cannot find map.json for ${version}`);
  }
}

export function getStaticDocumentPaths(version: string) {
  const paths = [];

  function recur(curr, acc) {
    if (curr.itemList) {
      curr.itemList.forEach((ii) => {
        recur(ii, [...acc, curr.id]);
      });
      return;
    }

    paths.push({
      params: {
        version,
        flavor: acc[0],
        segments: acc.slice(1).concat(curr.id),
      },
    });
  }

  getDocuments(version).forEach((item) => {
    recur(item, []);
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

let versions: VersionMetadata[];
export function getVersions(): VersionMetadata[] {
  if (!versions) {
    versions = readJsonFile(join(archiveRootPath, 'versions.json'));
  }
  return versions;
}
