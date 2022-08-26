import { DocumentData, DocumentMetadata } from '@nrwl/nx-dev/models-document';
import { parseMarkdown } from '@nrwl/nx-dev/ui-markdoc';
import { readFileSync } from 'fs';
import { load as yamlLoad } from 'js-yaml';
import { join } from 'path';
import { extractTitle } from './documents.utils';

export interface StaticDocumentPaths {
  params: { segments: string[] };
}

export class DocumentsApi {
  private documents: DocumentMetadata;
  constructor(
    private readonly options: {
      publicDocsRoot: string;
      documentSources: DocumentMetadata[];
      addAncestor: { id: string; name: string } | null;
    }
  ) {
    if (!options.publicDocsRoot) {
      throw new Error('public docs root cannot be undefined');
    }
    if (!options.documentSources) {
      throw new Error('public document sources cannot be undefined');
    }

    const itemList: DocumentMetadata[] = options.documentSources.flatMap(
      (x) => x.itemList
    ) as DocumentMetadata[];

    this.documents = {
      id: 'documents',
      name: 'documents',
      itemList: !!this.options.addAncestor
        ? [
            {
              id: this.options.addAncestor.id,
              name: this.options.addAncestor.name,
              itemList,
            },
          ]
        : itemList,
    };
  }

  getDocument(path: string[]): DocumentData {
    const docPath = this.getFilePath(path);

    const originalContent = readFileSync(docPath, 'utf8');
    const ast = parseMarkdown(originalContent);
    const frontmatter = ast.attributes.frontmatter
      ? yamlLoad(ast.attributes.frontmatter)
      : {};

    // Set default title if not provided in front-matter section.
    if (!frontmatter.title) {
      frontmatter.title =
        extractTitle(originalContent) ?? path[path.length - 1];
    }

    return {
      filePath: docPath,
      data: frontmatter,
      content: originalContent,
    };
  }

  getDocuments(): DocumentMetadata {
    const docs = this.documents;
    if (docs) return docs;
    throw new Error(`Cannot find any documents`);
  }

  getStaticDocumentPaths(): StaticDocumentPaths[] {
    const paths: StaticDocumentPaths[] = [];

    function recur(curr, acc) {
      if (curr.isExternal) return;
      if (curr.itemList) {
        curr.itemList.forEach((ii) => {
          recur(ii, [...acc, curr.id]);
        });
      } else {
        paths.push({
          params: {
            segments: curr.path
              ? curr.path.split('/').filter(Boolean).flat()
              : [...acc, curr.id],
          },
        });
      }
    }

    if (!this.documents || !this.documents.itemList)
      throw new Error(`Can't find any items`);
    this.documents.itemList.forEach((item) => {
      recur(item, []);
    });

    return paths;
  }

  /**
   * Getting the document's filePath is done in 2 steps
   * - traversing the tree by path segments
   * - if not found, try searching for it via the complete path string
   * @param path
   * @private
   */
  private getFilePath(path: string[]): string {
    let items = this.documents?.itemList;

    if (!items) {
      throw new Error(`Document not found`);
    }

    let found: DocumentMetadata | null = null;
    // Traversing the tree by matching item's ids with path's segments
    for (const part of path) {
      found = items?.find((item) => item.id === part) || null;
      if (found) {
        items = found.itemList;
      }
    }

    // If still not found, then attempt to match any item's id with the current path as a string
    if (!found) {
      function recur(curr, acc) {
        if (curr.itemList) {
          curr.itemList.forEach((ii) => {
            recur(ii, [...acc, curr.id]);
          });
        } else {
          if (curr.path === '/' + path.join('/')) {
            found = curr;
          }
        }
      }
      this.documents.itemList!.forEach((item) => {
        recur(item, []);
      });
    }

    if (!found) throw new Error(`Document not found`);
    const file = found.file ?? ['generated', ...path].join('/');
    return join(this.options.publicDocsRoot, `${file}.md`);
  }
}
