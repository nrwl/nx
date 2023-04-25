import {
  DocumentMetadata,
  ProcessedDocument,
  RelatedDocument,
} from '@nx/nx-dev/models-document';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TagsApi } from './tags.api';

interface StaticDocumentPaths {
  params: { segments: string[] };
}

export class DocumentsApi {
  private readonly manifest: Record<string, DocumentMetadata>;

  constructor(
    private readonly options: {
      id: string;
      manifest: Record<string, DocumentMetadata>;
      prefix: string;
      publicDocsRoot: string;
      tagsApi: TagsApi;
    }
  ) {
    if (!options.id) {
      throw new Error('id cannot be undefined');
    }
    if (!options.prefix) {
      options.prefix = '';
    }
    if (!options.publicDocsRoot) {
      throw new Error('public docs root cannot be undefined');
    }
    if (!options.manifest) {
      throw new Error('public document sources cannot be undefined');
    }

    this.manifest = structuredClone(this.options.manifest);
  }
  private getManifestKey(path: string): string {
    return '/' + path;
  }

  getFilePath(path: string): string {
    return join(this.options.publicDocsRoot, `${path}.md`);
  }

  getParamsStaticDocumentPaths(): StaticDocumentPaths[] {
    return Object.keys(this.manifest).map((path) => ({
      params: {
        segments: !!this.options.prefix
          ? [this.options.prefix].concat(path.split('/').filter(Boolean).flat())
          : path.split('/').filter(Boolean).flat(),
      },
    }));
  }
  getSlugsStaticDocumentPaths(): string[] {
    if (this.options.prefix)
      return Object.keys(this.manifest).map(
        (path) => `/${this.options.prefix}` + path
      );
    return Object.keys(this.manifest);
  }

  getDocument(path: string[]): ProcessedDocument {
    const document: DocumentMetadata | null =
      this.manifest[this.getManifestKey(path.join('/'))] || null;

    if (!document)
      throw new Error(
        `Document not found in manifest with: "${path.join('/')}"`
      );
    if (this.isDocumentIndex(document)) return this.getDocumentIndex(path);
    return {
      content: readFileSync(this.getFilePath(document.file), 'utf8'),
      description: document.description,
      filePath: this.getFilePath(document.file),
      id: document.id,
      name: document.name,
      relatedDocuments: this.getRelatedDocuments(document.tags),
      tags: document.tags,
    };
  }

  getRelatedDocuments(tags: string[]): Record<string, RelatedDocument[]> {
    const relatedDocuments = {};
    tags.forEach(
      (tag) =>
        (relatedDocuments[tag] = this.options.tagsApi.getAssociatedItems(tag))
    );

    return relatedDocuments;
  }

  isDocumentIndex(document: DocumentMetadata): boolean {
    return !!document.itemList.length;
  }
  generateDocumentIndexTemplate(document: DocumentMetadata): string {
    const cardsTemplate = document.itemList
      .map((i) => ({
        title: i.name,
        description: i.description ?? '',
        url: i.path,
      }))
      .map(
        (card) =>
          `{% card title="${card.title}" description="${
            card.description
          }" url="${[this.options.prefix, card.url]
            .filter(Boolean)
            .join('/')}" /%}\n`
      )
      .join('');
    return [
      `# ${document.name}\n\n ${document.description ?? ''}\n\n`,
      '{% cards %}\n',
      cardsTemplate,
      '{% /cards %}\n\n',
    ].join('');
  }
  getDocumentIndex(path: string[]): ProcessedDocument {
    const document: DocumentMetadata | null =
      this.manifest[this.getManifestKey(path.join('/'))] || null;

    if (!document)
      throw new Error(
        `Document not found in manifest with: "${path.join('/')}"`
      );

    if (!!document.file)
      return {
        content: readFileSync(this.getFilePath(document.file), 'utf8'),
        description: document.description,
        filePath: this.getFilePath(document.file),
        id: document.id,
        name: document.name,
        relatedDocuments: this.getRelatedDocuments(document.tags),
        tags: document.tags,
      };

    return {
      content: this.generateDocumentIndexTemplate(document),
      description: document.description,
      filePath: '',
      id: document.id,
      name: document.name,
      relatedDocuments: this.getRelatedDocuments(document.tags),
      tags: document.tags,
    };
  }

  generateRootDocumentIndex(options: {
    name: string;
    description: string;
  }): ProcessedDocument {
    const document = {
      id: 'root',
      name: options.name,
      description: options.description,
      file: '',
      path: '',
      isExternal: false,
      itemList: Object.keys(this.manifest)
        .filter((k) => k.split('/').length < 4) // Getting only top categories
        .map((k) => this.manifest[k]),
      tags: [],
    };

    return {
      content: this.generateDocumentIndexTemplate(document),
      description: document.description,
      filePath: '',
      id: document.id,
      name: document.name,
      relatedDocuments: this.getRelatedDocuments(document.tags),
      tags: document.tags,
    };
  }
}
