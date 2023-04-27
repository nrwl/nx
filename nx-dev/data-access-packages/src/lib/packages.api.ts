import { TagsApi } from '@nx/nx-dev/data-access-documents/node-only';
import { DocumentMetadata } from '@nx/nx-dev/models-document';
import {
  FileMetadata,
  IntrinsicPackageMetadata,
  ProcessedPackageMetadata,
  SchemaMetadata,
} from '@nx/nx-dev/models-package';
import { readFileSync } from 'fs';
import { join } from 'path';

interface StaticDocumentPaths {
  params: { segments: string[] };
}

export class PackagesApi {
  private readonly manifest: Record<string, ProcessedPackageMetadata>;

  constructor(
    private readonly options: {
      id: string;
      manifest: Record<string, ProcessedPackageMetadata>;
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

  getFilePath(path: string): string {
    return join(this.options.publicDocsRoot, path);
  }

  /**
   * Give a list of available segments/paths for the Nextjs app.
   */
  getStaticDocumentPaths(): {
    packages: StaticDocumentPaths[];
    documents: StaticDocumentPaths[];
    executors: StaticDocumentPaths[];
    generators: StaticDocumentPaths[];
  } {
    /**
     * TODO: Extract this into utils, can be used by DocumentsAPI as well.
     * Generate a Nextjs Segments Param from a path and prefix (optional)
     * @param {string} path
     * @param {string} prefix
     * @returns {StaticDocumentPaths}
     */
    function generateSegments(
      path: string,
      prefix: string = ''
    ): StaticDocumentPaths {
      const segments = path.split('/').filter(Boolean).flat();
      return {
        params: {
          segments: !!prefix ? [prefix].concat(segments) : segments,
        },
      };
    }

    const packages = Object.values(this.manifest);
    const experiment: {
      packages: StaticDocumentPaths[];
      documents: StaticDocumentPaths[];
      executors: StaticDocumentPaths[];
      generators: StaticDocumentPaths[];
    } = {
      packages: [],
      documents: [],
      executors: [],
      generators: [],
    };

    packages.forEach((p) => {
      experiment.packages.push(generateSegments(p.path, this.options.prefix));

      Object.keys(p.documents).map((path) =>
        experiment.documents.push(generateSegments(path, this.options.prefix))
      );

      Object.keys(p.executors).forEach((path) =>
        experiment.executors.push(generateSegments(path, this.options.prefix))
      );

      Object.keys(p.generators).forEach((path) =>
        experiment.generators.push(generateSegments(path, this.options.prefix))
      );
    });

    return experiment;
  }

  getPackage(path: string[]): ProcessedPackageMetadata {
    const pkg: ProcessedPackageMetadata | null =
      this.manifest[path.join('/')] || null;

    if (!pkg)
      throw new Error(
        `Package not found in manifest with: "${path.join('/')}"`
      );

    return {
      ...pkg,
      description: pkg.documents['overview']
        ? readFileSync(pkg.documents['overview'].file, 'utf-8')
        : pkg.description,
    };
  }

  getPackageDocuments(name: string): Record<string, DocumentMetadata> {
    return this.manifest[name]['documents'];
  }
  getPackageFileMetadatas(
    name: string,
    type: 'executors' | 'generators'
  ): Record<string, FileMetadata> {
    return this.manifest[name][type];
  }
  getSchemaMetadata(fileMetadata: FileMetadata): SchemaMetadata {
    return JSON.parse(
      readFileSync(this.getFilePath(fileMetadata.file), 'utf-8')
    );
  }

  getRootPackageIndex(): IntrinsicPackageMetadata[] {
    return Object.keys(this.manifest).map((k) => ({
      description: this.manifest[k].description,
      githubRoot: this.manifest[k].githubRoot,
      name: this.manifest[k].name,
      packageName: this.manifest[k].packageName,
      path: this.manifest[k].path,
      root: this.manifest[k].root,
      source: this.manifest[k].source,
    }));
  }
}
