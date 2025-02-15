import { readFileSync } from 'fs';
import { join } from 'path';
import {
  getSchemaFromReference,
  Lookup,
} from '@nx/nx-dev/data-access-packages';
import { NxSchema } from '@nx/nx-dev/models-package';
import { isArray, isObject } from './utils';

function traverseAndReplaceReferences(
  item: Record<string, any> | any[] = {},
  keyToMatch = '',
  lookup: Lookup
) {
  if (isObject(item)) {
    const entries = Object.entries(item);

    for (let i = 0; i < entries.length; i += 1) {
      const [objectKey, objectValue] = entries[i];

      if (objectKey === keyToMatch) {
        return { $$$matched: objectValue };
      }

      if (isObject(objectValue)) {
        const child = traverseAndReplaceReferences(
          objectValue,
          keyToMatch,
          lookup
        );

        if (
          child &&
          Object.prototype.hasOwnProperty.call(child, '$$$matched')
        ) {
          item[objectKey] = getSchemaFromReference(
            child.$$$matched,
            lookup
          ) as any;
        }
      }
    }
  }
  if (isArray(item)) {
    item.forEach((subItem) => {
      if (isObject(subItem) || isArray(subItem))
        traverseAndReplaceReferences(subItem, keyToMatch, lookup);
    });
  }
}

export function getExamplesFileFromPath(
  rootPath: string,
  examplesFilePath: string
): string {
  let result: string = '';
  const path: string = join(rootPath, examplesFilePath);
  try {
    result = readFileSync(path, 'utf-8');
  } catch (e) {
    console.log('Could not resolve example for current schema: ', path);
  }
  return result;
}

export function schemaResolver(
  schema: NxSchema,
  lookup: Lookup,
  path: string
): {
  resolveReferences: () => void;
  resolveExamplesFile: () => void;
  getSchema: () => NxSchema;
} {
  const updatedSchema: NxSchema = structuredClone(schema);
  return {
    resolveReferences: () => {
      traverseAndReplaceReferences(updatedSchema, '$ref', lookup);
      return void 0;
    },
    resolveExamplesFile: () => {
      if (Object.prototype.hasOwnProperty.call(updatedSchema, 'examplesFile'))
        updatedSchema.examplesFile = getExamplesFileFromPath(
          path,
          updatedSchema.examplesFile as string
        );
      return void 0;
    },
    getSchema: () => updatedSchema,
  };
}
