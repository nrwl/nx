import {
  chain,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import { normalizeProjectOptions } from '../../utils/normalize';
import { addExportsToBarrelFile, createFiles } from '../../utils/files';

export interface NormalizedSchema extends Schema {
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

export default function(schema: Schema): Rule {
  return async (host: Tree, context: SchematicContext) => {
    const options: NormalizedSchema = await normalizeProjectOptions(
      host,
      schema
    );

    return chain([
      createFiles(options),
      addExportsToBarrelFile(options, [
        `export * from './lib/${options.fileName}.guard';`
      ])
    ]);
  };
}
