import { readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { extractTitle } from './documents.utils';
import {
  DocumentData,
  DocumentMetadata,
  FlavorMetadata,
  VersionMetadata,
} from './documents.models';

export interface StaticDocumentPaths {
  params: { segments: string[] };
}

export class DocumentsApi {
  constructor(
    private readonly options: {
      publicDocsRoot: string;
      versions: VersionMetadata[];
      flavors: FlavorMetadata[];
      documentsMap: Map<string, DocumentMetadata[]>;
    }
  ) {
    if (!options.publicDocsRoot) {
      throw new Error('public docs root cannot be undefined');
    }
  }

  getDefaultVersion(): VersionMetadata {
    const found = this.options.versions.find((v) => v.default);
    if (found) return found;
    throw new Error('Cannot find default version');
  }

  getDefaultFlavor(): FlavorMetadata {
    const found = this.options.flavors.find((f) => f.default);
    if (found) return found;
    throw new Error('Cannot find default flavor');
  }

  getVersions(): VersionMetadata[] {
    return this.options.versions;
  }

  getFlavors(): FlavorMetadata[] {
    return this.options.flavors;
  }

  getDocument(
    version: VersionMetadata,
    flavor: FlavorMetadata,
    path: string[]
  ): DocumentData {
    const docPath = this.getFilePath(version.id, flavor.id, path);
    const originalContent = readFileSync(docPath, 'utf8');
    const file = matter(originalContent);

    // Set default title if not provided in front-matter section.
    if (!file.data.title) {
      file.data.title = extractTitle(originalContent) ?? path[path.length - 1];
      file.data.description = file.excerpt ?? path[path.length - 1];
    }

    return {
      filePath: docPath,
      data: file.data,
      content: file.content,
      excerpt: file.excerpt,
    };
  }

  getDocuments(version: string) {
    const docs = this.options.documentsMap.get(version);
    if (docs) {
      return docs;
    } else {
      throw new Error(`Cannot find documents for ${version}`);
    }
  }

  getStaticDocumentPaths(
    version: VersionMetadata,
    flavor: FlavorMetadata
  ): StaticDocumentPaths[] {
    const paths: StaticDocumentPaths[] = [];
    const defaultVersion = this.getDefaultVersion();

    function recur(curr, acc) {
      if (curr.itemList) {
        curr.itemList.forEach((ii) => {
          recur(ii, [...acc, curr.id]);
        });
      } else {
        paths.push({
          params: {
            segments: [version.alias, flavor.alias, ...acc, curr.id],
          },
        });

        /**
         * Generic path generation
         * For generic paths such as `/getting-started/intro`, use the default version and react flavor.
         */
        if (version.id === defaultVersion.id && flavor.id === 'react')
          paths.push({
            params: {
              segments: [...acc, curr.id],
            },
          });
      }
    }

    const item = this.getDocuments(version.id).find(
      (item) => item.id === flavor.id
    );
    if (!item || !item.itemList)
      throw new Error(
        `Can't find items for version:${version.id} and flavor:${flavor.id}`
      );
    item.itemList.forEach((item) => {
      recur(item, []);
    });

    return paths;
  }

  getDocumentsRoot(version: string): string {
    const versionPath = this.options.versions.find(
      (x) => x.id === version
    )?.path;

    if (versionPath) {
      return join(this.options.publicDocsRoot, versionPath);
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
      found = items?.find((item) => item.id === part);
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
