import * as fs from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import * as marked from 'marked';
import {
  getDocumentsMap,
  getDocumentsRoot,
  getVersions as _getVersions,
} from './utils';
import { DocumentData, VersionData } from './models';

export function getDocument(
  version: string,
  _segments: string | string[]
): DocumentData {
  const segments = Array.isArray(_segments) ? [..._segments] : [_segments];
  const docPath = getFilePath(version, segments);
  const file = matter(fs.readFileSync(docPath, 'utf8'));

  return {
    filePath: docPath,
    data: file.data,
    content: marked.parse(file.content),
    excerpt: file.excerpt,
  };
}

export function getFilePath(version: string, segments: string[]): string {
  let items = getDocumentsMap(version);
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

export function getAllDocumentsPaths(version: string) {
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

  getDocumentsMap(version).forEach((item) => {
    recur(item, [item.id]);
  });

  return paths;
}

export function getVersions(): VersionData[] {
  return _getVersions();
}
