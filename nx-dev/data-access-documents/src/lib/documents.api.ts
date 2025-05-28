import {
  pkgToGeneratedApiDocs,
  type DocumentMetadata,
  type ProcessedDocument,
  type RelatedDocument,
} from '@nx/nx-dev/models-document';
import { type ProcessedPackageMetadata } from '@nx/nx-dev/models-package';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TagsApi } from './tags.api';

interface StaticDocumentPaths {
  params: { segments: string[] };
}

export class DocumentsApi {
  private readonly manifest: Record<string, DocumentMetadata>;
  private readonly packagesManifest?: Record<string, ProcessedPackageMetadata>;

  constructor(
    private readonly options: {
      id: string;
      manifest: Record<string, DocumentMetadata>;
      packagesManifest?: Record<string, ProcessedPackageMetadata>;
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
    if (this.options.packagesManifest) {
      this.packagesManifest = structuredClone(this.options.packagesManifest);
    }
    if (
      options.id === 'angular-rspack-documents' ||
      options.id === 'angular-rsbuild-documents'
    ) {
      this.manifest = Object.assign(
        this.manifest,
        this.getAngularRspackPackage()
      );
    }
  }

  private getManifestKey(path: string): string {
    return '/' + path;
  }

  // TODO(colum): Remove this once we move angular rspack into main repo (when stable).
  getAngularRspackPackage(): Record<string, DocumentMetadata> {
    return {
      '/nx-api/angular-rspack/documents/create-config': {
        id: 'create-config',
        name: 'createConfig',
        description: 'createConfig for @nx/angular-rspack',
        path: '/nx-api/angular-rspack/documents/create-config',
        file: 'shared/guides/angular-rspack/api/nx-angular-rspack/create-config',
        isExternal: false,
        itemList: [],
        tags: [],
      },
      '/nx-api/angular-rspack/documents/create-server': {
        id: 'create-server',
        name: 'createServer',
        description: 'createServer for @nx/angular-rspack',
        path: '/nx-api/angular-rspack/documents/create-server',
        file: 'shared/guides/angular-rspack/api/nx-angular-rspack/create-server',
        isExternal: false,
        itemList: [],
        tags: [],
      },
      '/nx-api/angular-rsbuild/documents/create-config': {
        id: 'create-config',
        name: 'createConfig',
        description: 'createConfig for @nx/angular-rsbuild',
        path: '/nx-api/angular-rspack/documents/create-config',
        file: 'shared/guides/angular-rspack/api/nx-angular-rsbuild/create-config',
        isExternal: false,
        itemList: [],
        tags: [],
      },
      '/nx-api/angular-rsbuild/documents/create-server': {
        id: 'create-server',
        name: 'createServer',
        description: 'createServer for @nx/angular-rsbuild',
        path: '/nx-api/angular-rspack/documents/create-server',
        file: 'shared/guides/angular-rspack/api/nx-angular-rsbuild/create-server',
        isExternal: false,
        itemList: [],
        tags: [],
      },
    };
  }

  getFilePath(path: string): string {
    return join(this.options.publicDocsRoot, path);
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
    let paths: string[] = [];

    // Add regular document paths
    if (this.options.prefix) {
      paths = Object.keys(this.manifest).map(
        (path) => `/${this.options.prefix}` + path
      );
    } else {
      paths = Object.keys(this.manifest);
    }

    // API Docs
    if (this.packagesManifest) {
      const packages = Object.values(this.packagesManifest);

      packages.forEach((pkg) => {
        const apiDocData = pkgToGeneratedApiDocs[pkg.name];
        // Packages are not mapped, skip creating URLs for them.
        if (!apiDocData) return;
        const apiPagePath = apiDocData.pagePath;
        paths.push(apiPagePath);

        if (apiDocData.includeDocuments) {
          paths.push(`${apiPagePath}/documents`);
          Object.keys(pkg.documents).forEach((path) => {
            console.log('>>>>>>>>>adding', path);
            paths.push(path);
          });
        }

        paths.push(`${apiPagePath}/executors`);
        Object.keys(pkg.executors).forEach((path) => {
          paths.push(path);
        });

        paths.push(`${apiPagePath}/generators`);
        Object.keys(pkg.generators).forEach((path) => {
          paths.push(path);
        });

        paths.push(`${apiPagePath}/migrations`);
      });
    }
    return paths;
  }

  getDocument(path: string[]): ProcessedDocument {
    const document: DocumentMetadata | null =
      this.manifest[this.getManifestKey(path.join('/'))] || null;

    if (!document) {
      // Handle API docs paths now at /technologies/{pkg}/{category}/...
      if (path[0] === 'technologies' && this.packagesManifest) {
        const packageName = path[1];
        const category = path[2]; // 'executors', 'generators', or 'migrations'

        // Try to find the package in packagesManifest
        const pkg = Object.values(this.packagesManifest).find(
          (p) => p.name === packageName
        );

        if (pkg) {
          // Check if the category exists
          if (
            category === 'executors' ||
            category === 'generators' ||
            category === 'migrations'
          ) {
            // Create the original nx-api path
            // TODO(docs): We should update generate manifest script so we don't have to rebuild this path. We may also consider pushing this when we switch frameworks.
            const targetSegment = path.slice(3).join('/');
            const originalPath = `/nx-api/${packageName}/${category}/${targetSegment}`;

            // Get the file metadata from the package
            const fileMetadata = pkg[category][originalPath];

            if (fileMetadata) {
              try {
                // Read the schema file
                const schemaContent = JSON.parse(
                  readFileSync(this.getFilePath(fileMetadata.file), 'utf-8')
                );

                return {
                  content:
                    fileMetadata.description || schemaContent.description || '',
                  description:
                    fileMetadata.description || schemaContent.description || '',
                  filePath: this.getFilePath(fileMetadata.file),
                  id: fileMetadata.name,
                  name: fileMetadata.name,
                  relatedDocuments: {},
                  tags: [],
                };
              } catch (e) {
                throw new Error(`Error reading schema file: ${e.message}`);
              }
            }
          }
        }
      }

      // Legacy handler for devkit docs
      if (
        path[0] === 'nx-api' &&
        path[1] === 'devkit' &&
        path[2] === 'documents'
      ) {
        const file = `generated/devkit/${path.slice(3).join('/')}`;
        return {
          content: readFileSync(this.getFilePath(`${file}.md`), 'utf8'),
          description: '',
          filePath: this.getFilePath(file),
          id: path.at(-1) || '',
          name: path.at(-1) || '',
          relatedDocuments: {},
          tags: [],
        };
      }
      throw new Error(
        `Document not found in manifest with: "${path.join('/')}"`
      );
    }
    if (this.isDocumentIndex(document)) return this.getDocumentIndex(path);
    return {
      content: readFileSync(this.getFilePath(`${document.file}.md`), 'utf8'),
      description: document.description,
      filePath: this.getFilePath(`${document.file}.md`),
      id: document.id,
      name: document.name,
      mediaImage: document.mediaImage || '',
      relatedDocuments: this.getRelatedDocuments(document.tags),
      parentDocuments: path.map((segment, index): RelatedDocument => {
        const parentPath = path.slice(0, index + 1).join('/');
        const parentDocument =
          this.manifest[this.getManifestKey(parentPath)] || null;
        if (!parentDocument) {
          return {
            id: segment,
            name: '',
            description: '',
            file: '',
            path: '/' + path.slice(0, index + 1).join('/'),
          };
        }
        return {
          id: parentDocument.id,
          name: parentDocument.name,
          description: parentDocument.description,
          file: parentDocument.file,
          path: parentDocument.path,
        };
      }),
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
    return !!document.itemList.length || !document.file;
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
      ...(!document.itemList.length
        ? ['No items found.']
        : ['{% cards %}\n', cardsTemplate, '{% /cards %}\n\n']),
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
        content: readFileSync(this.getFilePath(`${document.file}.md`), 'utf8'),
        description: document.description,
        filePath: this.getFilePath(`${document.file}.md`),
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
