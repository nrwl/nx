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

  getPackage(name: string): PackageMetadata {
    const packagePath: string | null =
      this.options.packagesIndex.find((p) => p.name === name)?.path ?? null;

    if (!packagePath)
      throw new Error('Package name could not be found: ' + name);

    if (!this.database[name])
      this.database[name] = JSON.parse(
        readFileSync(
          [this.options.publicPackagesRoot, packagePath].join('/'),
          'utf-8'
        )
      );

    return this.database[name];
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

  getPackageSchema(
    packageName: string,
    type: 'executors' | 'generators',
    schemaName: string
  ): SchemaMetadata | null {
    const file = this.getPackage(packageName);
    return file[type].find((s) => s.name === schemaName) ?? null;
  }
}
