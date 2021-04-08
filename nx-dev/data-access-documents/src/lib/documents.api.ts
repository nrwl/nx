import * as fs from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import * as marked from 'marked';
import { readJsonFile } from '@nrwl/workspace';

import { archiveRootPath, getVersionRootPath } from './documents.paths';
import { DocumentData, VersionEntry } from './documents.models';

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

export function getDocuments(version: string) {
  try {
    return readJsonFile(join(getVersionRootPath(version), 'map.json'));
  } catch {
    throw new Error(`Cannot find map.json for ${version}`);
  }
}

export function getDocumentsByFlavor(version: string, flavor: string) {
  const list = getDocuments(version);
  const item = list.find((x) => x.id === flavor);
  if (item) {
    return item.itemList;
  } else {
    throw new Error(`Cannot find documents for ${flavor} at ${version}`);
  }
}

function getFilePath(version: string, segments: string[]): string {
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
  return join(getVersionRootPath(version), `${found.file}.md`);
}

export function getStaticDocumentPaths(
  version: string
): Array<{ params: { version: string; flavor: string; segments: string[] } }> {
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

export function getArchivedVersions(): VersionEntry[] {
  return readJsonFile(join(archiveRootPath, 'versions.json'));
}
