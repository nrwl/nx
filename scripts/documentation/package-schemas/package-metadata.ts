import {
  convertToDocumentMetadata,
  DocumentMetadata,
} from '../../../nx-dev/models-document/src';
import { readFileSync } from 'fs';
import { readJsonSync } from 'fs-extra';
import { sync } from 'glob';
import { join, resolve } from 'path';
import * as DocumentationMap from '../../../docs/map.json';
import {
  JsonSchema1,
  PackageData,
  SchemaMetadata,
} from '../../../nx-dev/models-package/src';

function createSchemaMetadata(
  name: string,
  data: Record<string, any>,
  paths: {
    absoluteRoot: string;
    folderName: string;
    root: string;
  },
  type: 'executor' | 'generator'
): SchemaMetadata {
  const path = join(paths.root, data.schema);

  // "factory" is for Angular support, this is the same as "implementation"
  if (!data['implementation'] && data['factory'])
    data.implementation = data.factory;

  const schemaMetadata: SchemaMetadata = {
    name,
    ...data,
    aliases: data.aliases ?? [],
    description: data.description ?? '',
    hidden: data.hidden ?? false,
    implementation: join(paths.root, data.implementation) + '.ts',
    path, // Switching property for less confusing naming conventions
    schema: data.schema
      ? readJsonSync(join(paths.absoluteRoot, paths.root, data.schema))
      : null,
    type,
  };

  if (schemaMetadata.schema && !schemaMetadata.schema.presets) {
    schemaMetadata.schema.presets = [];
  }

  return schemaMetadata;
}

function getSchemaList(
  paths: {
    absoluteRoot: string;
    folderName: string;
    root: string;
  },
  collectionFileName: string,
  collectionEntries: string[]
): SchemaMetadata[] {
  const targetPath = join(paths.absoluteRoot, paths.root, collectionFileName);
  // We assume the type of the collection of schema is the name of the collection file (executors or generators)
  const type = collectionFileName.replace('.json', '').replace('s', '') as
    | 'executor'
    | 'generator';
  try {
    const metadata: SchemaMetadata[] = [];
    const collectionFile = readJsonSync(targetPath, 'utf8');
    for (const entry of collectionEntries) {
      if (!collectionFile[entry]) {
        continue;
      }

      metadata.push(
        ...Object.entries<JsonSchema1>(collectionFile[entry])
          .filter(([name]) => !metadata.find((x) => x.name === name))
          .map(([name, schema]: [string, JsonSchema1]) =>
            createSchemaMetadata(name, schema, paths, type)
          )
      );
    }

    return metadata;
  } catch (e) {
    console.log(
      `SchemaMetadata "${paths.root
        .split('/')
        .pop()}" resolution skipped: no file found at "${targetPath}".`
    );
    return [];
  }
}

/**
 * Generate the package metadata by exploring the directory path given.
 * @param absoluteRoot
 * @param packagesDirectory
 * @param documentationDirectory
 * @returns Configuration
 */
export function getPackageMetadataList(
  absoluteRoot: string,
  packagesDirectory: string = 'packages',
  documentationDirectory: string = 'docs'
): PackageData[] {
  const packagesDir = resolve(join(absoluteRoot, packagesDirectory));

  /**
   * Get all the custom overview information on each package if available
   */
  const additionalApiReferences: DocumentMetadata[] = DocumentationMap.content
    .find((data) => data.id === 'additional-api-references')!
    .itemList.map((item) => convertToDocumentMetadata(item));

  // Do not use map.json, but add a documentation property on the package.json directly that can be easily resolved
  return sync(`${packagesDir}/*`, { ignore: [`${packagesDir}/cli`] }).map(
    (folderPath): PackageData => {
      const folderName = folderPath.substring(packagesDir.length + 1);
      const relativeFolderPath = folderPath.replace(absoluteRoot, '');
      const packageJson = readJsonSync(
        join(folderPath, 'package.json'),
        'utf8'
      );
      const hasDocumentation = additionalApiReferences.find(
        (pkg) => pkg.id === folderName
      );

      return {
        githubRoot: 'https://github.com/nrwl/nx/blob/master',
        name: folderName,
        packageName: packageJson.name,
        description: packageJson.description,
        root: relativeFolderPath,
        source: join(relativeFolderPath, '/src'),
        documents: !!hasDocumentation
          ? hasDocumentation.itemList.map((item) => ({
              ...item,
              path: item.path,
              file: item.file,
              content: readFileSync(join('docs', item.file + '.md'), 'utf8'),
            }))
          : [],
        generators: getSchemaList(
          {
            absoluteRoot,
            folderName,
            root: relativeFolderPath,
          },
          'generators.json',
          ['generators']
        ),
        executors: getSchemaList(
          {
            absoluteRoot,
            folderName,
            root: relativeFolderPath,
          },
          'executors.json',
          ['executors', 'builders']
        ),
      };
    }
  );
}
