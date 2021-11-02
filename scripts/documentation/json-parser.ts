import { json } from '@angular-devkit/core';
import { SchemaFlattener } from './schema-flattener';

export enum OptionType {
  Any = 'any',
  Array = 'array',
  Boolean = 'boolean',
  Number = 'number',
  String = 'string',
}

function _getEnumFromValue<E, T extends E[keyof E]>(
  value: json.JsonValue,
  enumeration: E,
  defaultValue: T
): T {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  if (Object.values(enumeration).indexOf(value) !== -1) {
    // TODO: this should be unknown
    // tslint:disable-next-line:no-any
    return value as any as T;
  }

  return defaultValue;
}

export async function parseJsonSchemaToOptions(
  flattener: SchemaFlattener,
  schema: json.JsonObject
): Promise<any[]> {
  const options: any[] = [];

  function visitor(
    current: json.JsonObject | json.JsonArray,
    pointer: json.schema.JsonPointer,
    parentSchema?: json.JsonObject | json.JsonArray
  ) {
    if (!parentSchema) {
      // Ignore root.
      return;
    } else if (pointer.split(/\/(?:properties|definitions)\//g).length > 2) {
      // Ignore subitems (objects or arrays).
      return;
    } else if (json.isJsonArray(current)) {
      return;
    }

    if (pointer.indexOf('/not/') != -1) {
      // We don't support anyOf/not.
      throw new Error('The "not" keyword is not supported in JSON Schema.');
    }

    const ptr = json.schema.parseJsonPointer(pointer); // eg: /properties/commands => [ 'properties', 'commands' ]
    const name = ptr[ptr.length - 1]; // eg: 'commands'

    if (ptr[ptr.length - 2] != 'properties') {
      // Skip any non-property items.
      return;
    }

    const typeSet = json.schema.getTypesOfSchema(current); // eg: array

    if (typeSet.size == 0) {
      throw new Error('Cannot find type of schema.');
    }

    // We only support number, string or boolean (or array of those), so remove everything else.

    const types = Array.from(typeSet)
      .filter((x) => {
        switch (x) {
          case 'boolean':
          case 'number':
          case 'string':
          case 'array':
            return true;

          default:
            return false;
        }
      })
      .map((x) => _getEnumFromValue(x, OptionType, OptionType.String));

    if (types.length == 0) {
      // This means it's not usable on the command line. e.g. an Object.
      return;
    }

    // Only keep enum values we support (booleans, numbers and strings).
    const enumValues = (
      (json.isJsonArray(current.enum) && current.enum) ||
      []
    ).filter((x) => {
      switch (typeof x) {
        case 'boolean':
        case 'number':
        case 'string':
          return true;

        default:
          return false;
      }
    }) as any[];

    let defaultValue: string | number | boolean | undefined = undefined;
    if (current.default !== undefined) {
      switch (types[0]) {
        case 'string':
          if (typeof current.default == 'string') {
            defaultValue = current.default;
          }
          break;
        case 'number':
          if (typeof current.default == 'number') {
            defaultValue = current.default;
          }
          break;
        case 'boolean':
          if (typeof current.default == 'boolean') {
            defaultValue = current.default;
          }
          break;
      }
    }

    const type = types[0];
    const $default = current.$default;
    const $defaultIndex =
      json.isJsonObject($default) && $default['$source'] == 'argv'
        ? $default['index']
        : undefined;
    const positional: number | undefined =
      typeof $defaultIndex == 'number' ? $defaultIndex : undefined;

    const required =
      json.isJsonObject(parentSchema) && json.isJsonArray(parentSchema.required)
        ? parentSchema.required.indexOf(name) != -1
        : false;
    const aliases = json.isJsonArray(current.aliases)
      ? [...current.aliases].map((x) => `${x}`)
      : current.alias
      ? [`${current.alias}`]
      : [];
    const format =
      typeof current.format == 'string' ? current.format : undefined;
    const visible = current.visible === undefined || current.visible === true;
    const hidden = !!current.hidden || !visible;

    // Deprecated is set only if it's true or a string.
    const xDeprecated = current['x-deprecated'];
    const deprecated =
      xDeprecated === true || typeof xDeprecated == 'string'
        ? xDeprecated
        : undefined;

    const option: any = {
      name,
      description:
        current.description === undefined ? '' : `${current.description}`,
      ...(types.length == 1 ? { type } : { type, types }),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
      ...(enumValues && enumValues.length > 0 ? { enum: enumValues } : {}),
      required,
      aliases,
      ...(format !== undefined ? { format } : {}),
      hidden,
      ...(deprecated !== undefined ? { deprecated } : {}),
      ...(positional !== undefined ? { positional } : {}),
    };

    if (current.type === 'array' && current.items) {
      const items = current.items as {
        additionalProperties: boolean;
        properties: any;
        required?: string[];
        type: string;
      };

      if (items.properties) {
        option.arrayOfType = items.type;
        option.arrayOfValues = Object.keys(items.properties).map((key) => ({
          name: key,
          ...items.properties[key],
          isRequired: items.required && items.required.includes(key),
        }));
      }
    }

    options.push(option);
  }

  const flattenedSchema = flattener.flatten(schema);
  json.schema.visitJsonSchema(flattenedSchema, visitor);

  // Sort by positional.
  return options.sort((a, b) => {
    if (a.positional) {
      if (b.positional) {
        return a.positional - b.positional;
      } else {
        return 1;
      }
    } else if (b.positional) {
      return -1;
    } else {
      return 0;
    }
  });
}
