import { DocumentData, DocumentMetadata } from '@nrwl/nx-dev/models-document';
import { MenuItem } from '@nrwl/nx-dev/models-menu';
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
    // this.allDocuments = options.allDocuments;
  }

  /**
   * Generate the content of a "Category" or "Index" page, listing all its direct items.
   * @param path
   */
  getDocumentIndex(path: string[]): DocumentData | null {
    let items = this.documents?.itemList;
    let found: DocumentMetadata | null = null;
    let itemPathToValidate: string[] = [];

    for (const part of path) {
      found = items?.find((item) => item.id === part) || null;
      if (found) {
        itemPathToValidate.push(found.id);
        items = found.itemList;
      }
    }

    // If the ids have found the item, check that the segment correspond to the id tree
    if (found && path.join('/') !== itemPathToValidate.join('/')) {
      found = null;
    }

    if (!found) return null;

    const cardsTemplate = items
      ?.map((i) => ({
        title: i.name,
        description: i.description ?? '',
        url: i.path ?? '/' + path.concat(i.id).join('/'),
      }))
      .map(
        (card) =>
          `{% card title="${card.title}" description="${card.description}" url="${card.url}" /%}\n`
      )
      .join('');

    return {
      filePath: '',
      data: {
        title: found?.name,
      },
      content: [
        `# ${found?.name}\n\n ${found?.description ?? ''}\n\n`,
        '{% cards %}\n',
        cardsTemplate,
        '{% /cards %}\n\n',
      ].join(''),
    };
  }

  /**
   * Retrieve content from an existing markdown file using the `file` property.
   * @param path
   */
  getDocument(path: string[]): DocumentData {
    const { filePath, tags } = this.getDocumentInfo(path);

    const originalContent = readFileSync(filePath, 'utf8');
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
      filePath,
      data: frontmatter,
      content:
        originalContent + '\n\n' + this.getRelatedDocumentsSection(tags, path),
    };
  }

  getDocuments(): DocumentMetadata {
    const docs = this.documents;
    if (docs) return docs;
    throw new Error(`Cannot find any documents`);
  }

  getStaticDocumentPaths(): StaticDocumentPaths[] {
    const paths: StaticDocumentPaths[] = [];

    function recur(curr: DocumentMetadata, acc: string[]): void {
      if (curr.isExternal) return;

      // Enable addressable category path
      paths.push({
        params: {
          segments: curr.path
            ? curr.path.split('/').filter(Boolean).flat()
            : [...acc, curr.id],
        },
      });
      if (curr.itemList) {
        curr.itemList.forEach((ii) => {
          recur(ii, [...acc, curr.id]);
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
   * Getting the document's filePath from the `file` property is done in 2 steps:
   * - traversing the tree by path segments
   * - if not found, try searching for it via the complete path string
   * @param path
   * @private
   */
  private getDocumentInfo(path: string[]): {
    filePath: string;
    tags: string[];
  } {
    let items = this.documents?.itemList;

    if (!items) {
      throw new Error(`No document available for lookup`);
    }

    let found: DocumentMetadata | null = null;
    let itemPathToValidate: string[] = [];
    // Traversing the tree by matching item's ids with path's segments
    for (const part of path) {
      found = items?.find((item) => item.id === part) || null;
      if (found) {
        itemPathToValidate.push(found.id);
        items = found.itemList;
      }
    }
    // If the ids have found the item, check that the segment correspond to the id tree
    if (found && path.join('/') !== itemPathToValidate.join('/')) {
      found = null;
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
    const makeFilePath = (pathPart: string): string => {
      return join(this.options.publicDocsRoot, `${pathPart}.md`);
    };
    const file = found.file
      ? { filePath: makeFilePath(found.file), tags: found.tags || [] }
      : { filePath: makeFilePath(['generated', ...path].join('/')), tags: [] };
    return file;
  }

  /**
   * Displays a list of all concepts, recipes or reference documents that are tagged with the specified tag
   * Tags are defined in map.json
   * @returns
   * @param tags
   * @param path
   */
  private getRelatedDocumentsSection(tags: string[], path: string[]): string {
    let relatedConcepts: MenuItem[] = [];
    let relatedRecipes: MenuItem[] = [];
    let relatedReference: MenuItem[] = [];
    function recur(curr, acc) {
      if (curr.itemList) {
        curr.itemList.forEach((ii) => {
          recur(ii, [...acc, curr.id]);
        });
      } else if (path.join('/') === [...acc, curr.id].join('/')) {
        return;
      } else {
        if (
          curr.tags &&
          tags.some((tag) => curr.tags.includes(tag)) &&
          ['concepts', 'more-concepts'].some((id) => acc.includes(id))
        ) {
          curr.path = [...acc, curr.id].join('/');
          relatedConcepts.push(curr);
        }
        if (
          curr.tags &&
          tags.some((tag) => curr.tags.includes(tag)) &&
          acc.includes('recipes')
        ) {
          curr.path = [...acc, curr.id].join('/');
          relatedRecipes.push(curr);
        }
        if (
          curr.tags &&
          tags.some((tag) => curr.tags.includes(tag)) &&
          ['nx', 'workspace'].some((id) => acc.includes(id))
        ) {
          curr.path = [...acc, curr.id].join('/');
          relatedReference.push(curr);
        }
      }
    }
    this.documents.itemList!.forEach((item) => {
      recur(item, []);
    });

    if (
      relatedConcepts.length === 0 &&
      relatedRecipes.length === 0 &&
      relatedReference.length === 0
    ) {
      return '';
    }

    let output = '## Related Documentation\n';

    function listify(items: MenuItem[]): string {
      return items
        .map((item) => {
          return `- [${item.name}](${item.path})`;
        })
        .join('\n');
    }
    if (relatedConcepts.length > 0) {
      output += '### Concepts\n' + listify(relatedConcepts) + '\n';
    }
    if (relatedRecipes.length > 0) {
      output += '### Recipes\n' + listify(relatedRecipes) + '\n';
    }
    if (relatedReference.length > 0) {
      output += '### Reference\n' + listify(relatedReference) + '\n';
    }

    return output;
  }
}
