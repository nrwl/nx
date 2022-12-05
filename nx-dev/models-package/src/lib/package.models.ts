import { DocumentMetadata } from '@nrwl/nx-dev/models-document';
/**
 * To generate base json-schema models, you need to run the following command:
 * `npx json2ts nx-dev/models-package/src/lib/json-schema.draft-07.json > nx-dev/models-package/src/lib/json-schema.model.ts`
 */
import { JsonSchema1 } from './json-schema.models';

export type PackageContentTypes = 'documents' | 'executors' | 'generators';
export interface FileMetadata {
  description: string;
  file: string;
  hidden: boolean;
  name: string;
  originalFilePath: string;
  path: string;
  type: 'executor' | 'generator';
}

/**
 * Internally used during processing file by documentation script.
 * TODO@ben
 * @deprecated Need to be moved in /scripts/documentation
 */
export interface PackageData {
  description: string;
  documents: {
    tags: string[];
    id: string;
    name: string;
    itemList: any[];
    content: string;
    file: string;
    path: string;
  }[];
  executors: SchemaMetadata[];
  generators: SchemaMetadata[];
  githubRoot: string;
  name: string;
  packageName: string;
  root: string;
  source: string;
}

export interface PackageMetadata {
  description: string;
  documents: DocumentMetadata[];
  executors: FileMetadata[];
  generators: FileMetadata[];
  githubRoot: string;
  name: string;
  packageName: string;
  root: string;
  source: string;
}

export interface ProcessedPackageMetadata {
  description: string;
  documents: Record<string, DocumentMetadata>;
  executors: Record<string, FileMetadata>;
  generators: Record<string, FileMetadata>;
  githubRoot: string;
  name: string;
  packageName: string;
  path: string;
  root: string;
  source: string;
}

export interface SchemaMetadata {
  aliases: string[];
  description: string;
  hidden: boolean;
  implementation: string;
  name: string;
  path: string;
  schema: NxSchema | null;
  type: 'executor' | 'generator';
}

export interface NxSchema extends JsonSchema1 {
  title: string;
  description: string;
  presets: { name: string; keys: string[] }[];
  examplesFile: string;
  hidden: boolean;
}

export type IntrinsicPackageMetadata = Omit<
  ProcessedPackageMetadata,
  'executors' | 'documents' | 'generators'
>;
