/**
 * To generate base json-schema models, you need to run the following command:
 * `npx json2ts nx-dev/models-package/src/lib/json-schema.draft-07.json > nx-dev/models-package/src/lib/json-schema.model.ts`
 */
import { JsonSchema1 } from './json-schema.models';

export interface PackageMetadata {
  githubRoot: string;
  name: string;
  description: string;
  documentation: { id: string; name: string; content: string; file: string }[];
  root: string;
  source: string;
  generators: SchemaMetadata[];
  executors: SchemaMetadata[];
}

export interface SchemaMetadata {
  name: string;
  aliases: string[];
  implementation: string;
  path: string;
  schema: NxSchema | null;
  description: string;
  hidden: boolean;
}

export interface NxSchema extends JsonSchema1 {
  title: string;
  description: string;
  presets: { name: string; keys: string[] }[];
  examplesFile: string;
  hidden: boolean;
}
