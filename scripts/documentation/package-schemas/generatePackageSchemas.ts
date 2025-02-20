/*
 * Lookup for all the schema.json and add create a list with their path and related package information
 * */
import { createDocumentMetadata } from '@nx/nx-dev/models-document';
import * as chalk from 'chalk';
import { join, resolve } from 'path';
import { compare } from 'semver';
import {
  getSchemaFromReference,
  InternalLookup,
} from '@nx/nx-dev/data-access-packages';
import { NxSchema, PackageMetadata } from '@nx/nx-dev/models-package';
import { generateJsonFile, generateMarkdownFile } from '../utils';
import { findPackageMetadataList } from './package-metadata';
import { schemaResolver, getExamplesFileFromPath } from './schema.resolver';

function processSchemaData(data: NxSchema, path: string): NxSchema {
  const lookup = new InternalLookup(data);
  const schema = getSchemaFromReference('#', lookup) as NxSchema;

  if (schema === undefined)
    throw new Error('ERROR: Could not look up the schema at: ' + data.title);

  if (typeof schema === 'boolean')
    throw new Error('ERROR: Boolean schema not supported.');

  const resolver = schemaResolver(schema, lookup, path);
  resolver.resolveReferences();
  resolver.resolveExamplesFile();
  return resolver.getSchema();
}

function updateMigration(migration: any, absoluteRoot: string): any {
  if (!migration.implementation) {
    if (migration.packages) {
      migration.name = migration.name + '-package-updates';
    }
    return migration;
  }
  migration.examplesFile = getExamplesFileFromPath(
    absoluteRoot,
    migration.implementation.replace('.ts', '.md')
  );
  return migration;
}

function pathResolver(root: string): (path: string) => string {
  return (path) => join(root, path.replace('schema.json', ''));
}

export function generateLocalPackageSchemas(): Promise<void[]> {
  return generatePackageSchemas();
}

export function generateExternalPackageSchemas(): Promise<any> {
  const sourceRepositoryRelativePath = process.env.NX_OCEAN_RELATIVE_PATH;
  if (!sourceRepositoryRelativePath) {
    return Promise.all([]);
  }
  const sourcePackagesDirectory = 'libs/nx-packages';
  const sourcePackagesNamePrefix = 'powerpack-';
  return generatePackageSchemas(
    sourceRepositoryRelativePath,
    sourcePackagesDirectory,
    sourcePackagesNamePrefix
  );
}

export function generatePackageSchemas(
  sourceRepositoryRelativePath = '',
  sourcePackagesDirectory = 'packages',
  sourcePackagesNamePrefix = ''
): Promise<void[]> {
  console.log(`${chalk.blue('i')} Generating Package Schemas`);
  const absoluteRoot = resolve(join(__dirname, '../../../'));
  const sourceRepositoryRoot = resolve(
    join(__dirname, '../../../', sourceRepositoryRelativePath)
  );
  const generatedFolderName = sourceRepositoryRelativePath
    ? 'external-generated'
    : 'generated';

  const packages = findPackageMetadataList(
    sourceRepositoryRoot,
    sourcePackagesDirectory,
    sourcePackagesNamePrefix
  ).map((packageMetadata) => {
    const getCurrentSchemaPath = pathResolver(absoluteRoot);
    if (!!packageMetadata.executors.length) {
      packageMetadata.executors = packageMetadata.executors.map((item) => ({
        ...item,
        schema: processSchemaData(
          item.schema as NxSchema,
          getCurrentSchemaPath(item['path'].replace('schema.json', ''))
        ),
      }));
    }
    if (!!packageMetadata.generators.length) {
      packageMetadata.generators = packageMetadata.generators.map((item) => ({
        ...item,
        schema: processSchemaData(
          item.schema as NxSchema,
          getCurrentSchemaPath(item['path'].replace('schema.json', ''))
        ),
      }));
    }
    if (!!packageMetadata.migrations.length) {
      packageMetadata.migrations = packageMetadata.migrations
        .map((item) => ({
          ...updateMigration(item, absoluteRoot),
        }))
        .sort((m1, m2) => compare(m1.version, m2.version) * -1);
    }
    return packageMetadata;
  });
  const packagesMetadata = packages.map(
    (p): PackageMetadata => ({
      description: p.description,
      documents: p.documents.map((d) => ({
        ...createDocumentMetadata({
          description: d.description || p.description,
          file: [
            generatedFolderName,
            'packages',
            p.name,
            'documents',
            d.id,
          ].join('/'),
          id: d.id,
          itemList: d.itemList,
          name: d.name,
          path: [p.name, 'documents', d.id].join('/'),
          tags: d.tags,
        }),
        originalFilePath: d.file,
      })),
      executors: p.executors.map((e) => ({
        description: e.description,
        file: [
          generatedFolderName,
          'packages',
          p.name,
          'executors',
          e.name + '.json',
        ].join('/'),
        hidden: e.hidden,
        name: e.name,
        originalFilePath: e.path,
        path: [p.name, 'executors', e.name].join('/'),
        type: 'executor',
      })),
      generators: p.generators.map((g) => ({
        description: g.description,
        file: [
          generatedFolderName,
          'packages',
          p.name,
          'generators',
          g.name + '.json',
        ].join('/'),
        hidden: g.hidden,
        name: g.name,
        originalFilePath: g.path,
        path: [p.name, 'generators', g.name].join('/'),
        type: 'generator',
      })),
      migrations: p.migrations.map((m) => ({
        description: m.description,
        file: [
          generatedFolderName,
          'packages',
          p.name,
          'migrations',
          m.name + '.json',
        ].join('/'),
        hidden: m.hidden,
        name: m.name,
        version: (m as any).version,
        originalFilePath: m.path,
        path: [p.name, 'migrations', m.name].join('/'),
        type: 'migration',
      })),
      githubRoot: p.githubRoot,
      name: p.name,
      packageName: p.packageName,
      root: p.root,
      source: p.source,
    })
  );

  const outputPath: string = join(absoluteRoot, 'docs', generatedFolderName);
  const outputPackagesPath: string = join(outputPath, 'packages');
  const fileGenerationPromises: Promise<void>[] = [];

  // Generates all documents and schemas into their own directories per packages.
  packages.forEach((p) => {
    p.documents.forEach((d) =>
      fileGenerationPromises.push(
        generateMarkdownFile(join(outputPackagesPath, p.name, 'documents'), {
          name: d.id,
          template: d.content,
        })
      )
    );
    p.executors.forEach((e) =>
      fileGenerationPromises.push(
        generateJsonFile(
          join(outputPackagesPath, p.name, 'executors', e.name + '.json'),
          e
        )
      )
    );
    p.generators.forEach((g) =>
      fileGenerationPromises.push(
        generateJsonFile(
          join(outputPackagesPath, p.name, 'generators', g.name + '.json'),
          g
        )
      )
    );
    p.migrations.forEach((g) =>
      fileGenerationPromises.push(
        generateJsonFile(
          join(outputPackagesPath, p.name, 'migrations', g.name + '.json'),
          g
        )
      )
    );
  });

  // Generates the packages-metadata.json file.
  fileGenerationPromises.push(
    generateJsonFile(
      join(outputPath, 'packages-metadata.json'),
      packagesMetadata
    )
  );
  return Promise.all(fileGenerationPromises);
}
