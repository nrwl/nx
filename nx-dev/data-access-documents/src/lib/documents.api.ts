import { readFileSync } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';
import {
  archiveRootPath,
  extractTitle,
  previewRootPath,
} from './documents.utils';
import {
  DocumentData,
  DocumentMetadata,
  VersionMetadata,
} from './documents.models';

export const flavorList: { label: string; value: string }[] = [
  { label: 'Angular', value: 'angular' },
  { label: 'React', value: 'react' },
  { label: 'Node', value: 'node' },
];

export class DocumentsApi {
  constructor(
    private readonly versions: VersionMetadata[],
    private readonly documentsMap: Map<string, DocumentMetadata[]>
  ) {}

  getVersions(): VersionMetadata[] {
    return this.versions;
  }

  getDocument(
    versionId: string,
    flavorId: string,
    path: string[]
  ): DocumentData {
    const docPath = this.getFilePath(versionId, flavorId, path);
    const originalContent = readFileSync(docPath, 'utf8');
    const file = matter(originalContent);

    // Set default title if not provided in front-matter section.
    if (!file.data.title) {
      file.data.title = extractTitle(originalContent) ?? path[path.length - 1];
    }

    return {
      filePath: relative(
        versionId === 'preview' ? previewRootPath : archiveRootPath,
        docPath
      ),
      data: file.data,
      content: file.content,
      excerpt: file.excerpt,
    };
  }

  getDocuments(version: string) {
    const docs = this.documentsMap.get(version);
    if (docs) {
      return docs;
    } else {
      throw new Error(`Cannot find documents for ${version}`);
    }
  }

  getStaticDocumentPaths(version: string) {
    const paths = [];

    function recur(curr, acc) {
      if (curr.itemList) {
        curr.itemList.forEach((ii) => {
          recur(ii, [...acc, curr.id]);
        });
      } else {
        paths.push({
          params: {
            segments: [version, ...acc, curr.id],
          },
        });
      }
    }

    this.getDocuments(version).forEach((item) => {
      recur(item, []);
    });

    return paths;
  }

  getDocumentsRoot(version: string): string {
    if (version === 'preview') {
      return previewRootPath;
    }

    if (version === 'latest' || version === 'previous') {
      return join(
        archiveRootPath,
        this.versions.find((x) => x.id === version).path
      );
    }

    throw new Error(`Cannot find root for ${version}`);
  }

  private getFilePath(versionId, flavorId, path): string {
    let items = this.getDocuments(versionId).find(
      (item) => item.id === flavorId
    )?.itemList;

    if (!items) {
      throw new Error(`Document not found`);
    }

    let found;
    for (const part of path) {
      found = items.find((item) => item.id === part);
      if (found) {
        items = found.itemList;
      } else {
        throw new Error(`Document not found`);
      }
    }
    const file = found.file ?? [flavorId, ...path].join('/');
    return join(this.getDocumentsRoot(versionId), `${file}.md`);
  }
}
