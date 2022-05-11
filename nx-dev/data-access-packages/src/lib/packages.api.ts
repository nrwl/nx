import { DocumentMetadata } from '@nrwl/nx-dev/models-document';
import { PackageMetadata, SchemaMetadata } from '@nrwl/nx-dev/models-package';
import { readFileSync } from 'fs';

export interface StaticPackagePaths {
  params: { segments: string[] };
}

export class PackagesApi {
  private database: Record<string, PackageMetadata> = {};

  constructor(
    private readonly options: {
      publicPackagesRoot: string; // eg: nx-dev/nx-dev/public/documentation
      // packages.json content file
      packagesIndex: {
        name: string;
        path: string;
        schemas: { executors: string[]; generators: string[] };
      }[];
    }
  ) {
    if (!options.publicPackagesRoot) {
      throw new Error('public packages root cannot be undefined');
    }
  }

  getPackage(id: string): PackageMetadata {
    const packagePath: string | null =
      this.options.packagesIndex.find((p) => p.name === id)?.path ?? null;

    if (!packagePath) throw new Error('Package name could not be found: ' + id);

    if (!this.database[id])
      this.database[id] = JSON.parse(
        readFileSync(
          [this.options.publicPackagesRoot, packagePath].join('/'),
          'utf-8'
        )
      );

    return this.database[id];
  }

  getStaticPackagePaths(): StaticPackagePaths[] {
    const paths: StaticPackagePaths[] = [];

    this.options.packagesIndex.map((p) => {
      paths.push({
        params: {
          segments: ['packages', p.name],
        },
      });
      p.schemas.generators.forEach((g) => {
        paths.push({
          params: {
            segments: ['packages', p.name, 'generators', g],
          },
        });
      });
      p.schemas.executors.forEach((e) => {
        paths.push({
          params: {
            segments: ['packages', p.name, 'executors', e],
          },
        });
      });
    });
    return paths;
  }

  getPackageDocuments(): DocumentMetadata {
    return {
      id: 'packages',
      name: 'packages',
      itemList: this.options.packagesIndex.map((p) => ({
        id: p.name,
        name: p.name.replace(/-/gi, ' '),
        path: `/packages/${p.name}`,
        itemList: this.getPackage(p.name)
          .documentation.map((d) => ({
            id: d.id,
            name: d.name,
            path: d.path,
          }))
          .concat(
            p.schemas.executors.map((e) => ({
              id: e,
              name: e,
              path: `/packages/${p.name}/executors/${e}`,
            }))
          )
          .concat(
            p.schemas.generators.map((g) => ({
              id: g,
              name: g,
              path: `/packages/${p.name}/generators/${g}`,
            }))
          ),
      })),
    };
  }

  getPackageSchema(
    packageName: string,
    type: 'executors' | 'generators',
    schemaName: string
  ): SchemaMetadata | null {
    const file = this.getPackage(packageName);
    return file[type].find((s) => s.name === schemaName) ?? null;
  }
}
