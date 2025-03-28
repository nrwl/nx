import { logger } from './logger';
import type { NxJsonConfiguration } from '../config/nx-json';
import type {
  ProjectsConfigurations,
  TargetConfiguration,
} from '../config/workspace-json-project-json';

type PropertyDescription = {
  type?: string | string[];
  required?: string[];
  enum?: string[];
  properties?: Properties;
  oneOf?: PropertyDescription[];
  anyOf?: PropertyDescription[];
  allOf?: PropertyDescription[];
  items?: any;
  alias?: string;
  aliases?: string[];
  description?: string;
  format?: string;
  visible?: boolean;
  hidden?: boolean;
  default?:
    | string
    | number
    | boolean
    | string[]
    | { [key: string]: string | number | boolean | string[] };
  $ref?: string;
  $default?:
    | { $source: 'argv'; index: number }
    | { $source: 'projectName' }
    | { $source: 'unparsed' }
    | { $source: 'workingDirectory' };
  additionalProperties?: boolean | PropertyDescription;
  const?: any;
  'x-prompt'?:
    | string
    | { message: string; type: string; items?: any[]; multiselect?: boolean };
  'x-deprecated'?: boolean | string;
  'x-dropdown'?: 'projects';
  'x-priority'?: 'important' | 'internal';

  // Numbers Only
  multipleOf?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;

  // Strings Only
  pattern?: string;
  minLength?: number;
  maxLength?: number;

  // Objects Only
  patternProperties?: {
    [pattern: string]: PropertyDescription;
  };
};

type Properties = {
  [p: string]: PropertyDescription;
};
export type Schema = {
  properties: Properties;
  required?: string[];
  anyOf?: Partial<Schema>[];
  oneOf?: Partial<Schema>[];
  description?: string;
  definitions?: Properties;
  additionalProperties?: boolean | PropertyDescription;
  examples?: { command: string; description?: string }[];
  patternProperties?: {
    [pattern: string]: PropertyDescription;
  };
};

export type Unmatched = {
  name: string;
  possible: string[];
};

export type Options = {
  '--'?: Unmatched[];
  [k: string]: string | number | boolean | string[] | Unmatched[] | undefined;
};

function camelCase(input: string): string {
  if (input.indexOf('-') > 1) {
    return input
      .toLowerCase()
      .replace(/-(.)/g, (match, group1) => group1.toUpperCase());
  } else {
    return input;
  }
}

export function convertToCamelCase(
  parsed: { [k: string]: any },
  schema: Schema
): Options {
  return Object.keys(parsed).reduce((m, c) => {
    if (schema.properties[camelCase(c)]) {
      return { ...m, [camelCase(c)]: parsed[c] };
    } else {
      return { ...m, [c]: parsed[c] };
    }
  }, {});
}

/**
 * Coerces (and replaces) options identified as 'boolean' or 'number' in the Schema
 *
 * @param opts The options to check
 * @param schema The schema definition with types to check against
 *
 */
export function coerceTypesInOptions(opts: Options, schema: Schema): Options {
  Object.keys(opts).forEach((k) => {
    const prop = findSchemaForProperty(k, schema);

    opts[k] = coerceType(prop?.description, opts[k]);
  });
  return opts;
}

function coerceType(prop: PropertyDescription | undefined, value: any) {
  if (!prop) return value;
  if (typeof value !== 'string' && value !== undefined) return value;

  if (prop.oneOf) {
    for (let i = 0; i < prop.oneOf.length; ++i) {
      const coerced = coerceType(prop.oneOf[i], value);
      if (coerced !== value) {
        return coerced;
      }
    }
    return value;
  } else if (Array.isArray(prop.type)) {
    for (let i = 0; i < prop.type.length; ++i) {
      const coerced = coerceType({ type: prop.type[i] }, value);
      if (coerced !== value) {
        return coerced;
      }
    }
    return value;
  } else if (
    normalizedPrimitiveType(prop.type) == 'boolean' &&
    isConvertibleToBoolean(value)
  ) {
    return value === true || value == 'true';
  } else if (
    normalizedPrimitiveType(prop.type) == 'number' &&
    isConvertibleToNumber(value)
  ) {
    return Number(value);
  } else if (prop.type == 'array') {
    return value.split(',').map((v) => coerceType(prop.items, v));
  } else {
    return value;
  }
}

/**
 * Converts any options passed in with short aliases to their full names if found
 * Unmatched options are added to opts['--']
 *
 * @param opts The options passed in by the user
 * @param schema The schema definition to check against
 */
export function convertAliases(
  opts: Options,
  schema: Schema,
  excludeUnmatched: boolean
): Options {
  return Object.keys(opts).reduce((acc, k) => {
    const prop = findSchemaForProperty(k, schema);
    if (prop) {
      acc[prop.name] = opts[k];
    } else if (excludeUnmatched) {
      if (!acc['--']) {
        acc['--'] = [];
      }
      acc['--'].push({
        name: k,
        possible: [],
      });
    } else {
      acc[k] = opts[k];
    }
    return acc;
  }, {});
}

export class SchemaError {
  constructor(public readonly message: string) {}
}

export function validateOptsAgainstSchema(
  opts: { [k: string]: any },
  schema: Schema
) {
  validateObject(opts, schema, schema.definitions || {});
}

export function validateObject(
  opts: { [p: string]: any },
  schema: Schema | PropertyDescription,
  definitions: Properties
) {
  if (schema.anyOf) {
    const errors: Error[] = [];
    for (const s of schema.anyOf) {
      try {
        validateObject(opts, s, definitions);
      } catch (e) {
        errors.push(e);
      }
    }
    if (errors.length === schema.anyOf.length) {
      throw new Error(
        `Options did not match schema. Please fix any of the following errors:\n${errors
          .map((e) => ' - ' + e.message)
          .join('\n')}`
      );
    }
  }
  if (schema.oneOf) {
    const matches: Array<PropertyDescription> = [];
    const errors: Array<Error> = [];
    for (const propertyDescription of schema.oneOf) {
      try {
        validateObject(opts, propertyDescription, definitions);
        matches.push(propertyDescription);
      } catch (error) {
        errors.push(error);
      }
    }
    // If the options matched none of the oneOf property descriptions
    if (matches.length === 0) {
      throw new Error(
        `Options did not match schema: ${JSON.stringify(
          opts,
          null,
          2
        )}.\nPlease fix 1 of the following errors:\n${errors
          .map((e) => ' - ' + e.message)
          .join('\n')}`
      );
    }
    // If the options matched none of the oneOf property descriptions
    if (matches.length > 1) {
      throw new Error(
        `Options did not match schema: ${JSON.stringify(
          opts,
          null,
          2
        )}.\nShould only match one of \n${matches
          .map((m) => ' - ' + JSON.stringify(m))
          .join('\n')}`
      );
    }
  }

  (schema.required ?? []).forEach((p) => {
    if (opts[p] === undefined) {
      throw new SchemaError(`Required property '${p}' is missing`);
    }
  });

  if (
    schema.additionalProperties !== undefined &&
    schema.additionalProperties !== true
  ) {
    Object.keys(opts).find((p) => {
      if (
        Object.keys(schema.properties ?? {}).indexOf(p) === -1 &&
        (!schema.patternProperties ||
          !Object.keys(schema.patternProperties).some((pattern) =>
            new RegExp(pattern).test(p)
          ))
      ) {
        if (p === '_') {
          throw new SchemaError(
            `Schema does not support positional arguments. Argument '${opts[p]}' found`
          );
        } else if (schema.additionalProperties === false) {
          throw new SchemaError(`'${p}' is not found in schema`);
        } else if (typeof schema.additionalProperties === 'object') {
          validateProperty(
            p,
            opts[p],
            schema.additionalProperties,
            definitions
          );
        }
      }
    });
  }

  Object.keys(opts).forEach((p) => {
    validateProperty(p, opts[p], (schema.properties ?? {})[p], definitions);

    if (schema.patternProperties) {
      Object.keys(schema.patternProperties).forEach((pattern) => {
        if (new RegExp(pattern).test(p)) {
          validateProperty(
            p,
            opts[p],
            schema.patternProperties[pattern],
            definitions
          );
        }
      });
    }
  });
}

function validateProperty(
  propName: string,
  value: any,
  schema: PropertyDescription,
  definitions: Properties
) {
  if (!schema) return;

  if (schema.$ref) {
    schema = resolveDefinition(schema.$ref, definitions);
  }

  if (schema.oneOf) {
    if (!Array.isArray(schema.oneOf))
      throw new Error(`Invalid schema file. oneOf must be an array.`);

    const passes =
      schema.oneOf.filter((r) => {
        try {
          const rule = { type: schema.type, ...r };
          validateProperty(propName, value, rule, definitions);
          return true;
        } catch (e) {
          return false;
        }
      }).length === 1;
    if (!passes) throwInvalidSchema(propName, schema);
    return;
  }

  if (schema.anyOf) {
    if (!Array.isArray(schema.anyOf))
      throw new Error(`Invalid schema file. anyOf must be an array.`);

    let passes = false;
    schema.anyOf.forEach((r) => {
      try {
        const rule = { type: schema.type, ...r };
        validateProperty(propName, value, rule, definitions);
        passes = true;
      } catch (e) {}
    });
    if (!passes) throwInvalidSchema(propName, schema);
    return;
  }

  if (schema.allOf) {
    if (!Array.isArray(schema.allOf))
      throw new Error(`Invalid schema file. allOf must be an array.`);

    if (
      !schema.allOf.every((r) => {
        try {
          const rule = { type: schema.type, ...r };
          validateProperty(propName, value, rule, definitions);
          return true;
        } catch (e) {
          return false;
        }
      })
    ) {
      throwInvalidSchema(propName, schema);
    }
    return;
  }

  const isPrimitive = typeof value !== 'object';
  if (isPrimitive) {
    if (schema.const !== undefined && value !== schema.const) {
      throw new SchemaError(
        `Property '${propName}' does not match the schema. '${value}' should be '${schema.const}'.`
      );
    }

    if (Array.isArray(schema.type)) {
      const passes = schema.type.some((t) => {
        try {
          const rule = { type: t };
          validateProperty(propName, value, rule, definitions);
          return true;
        } catch (e) {
          return false;
        }
      });
      if (!passes) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. '${value}' should be a '${schema.type}'.`
        );
      }
    } else if (
      schema.type &&
      typeof value !== normalizedPrimitiveType(schema.type)
    ) {
      throw new SchemaError(
        `Property '${propName}' does not match the schema. '${value}' should be a '${schema.type}'.`
      );
    }

    if (schema.enum && !schema.enum.includes(value)) {
      throw new SchemaError(
        `Property '${propName}' does not match the schema. '${value}' should be one of ${schema.enum.join(
          ','
        )}.`
      );
    }

    if (schema.type === 'number') {
      if (
        typeof schema.multipleOf === 'number' &&
        value % schema.multipleOf !== 0
      ) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. ${value} should be a multiple of ${schema.multipleOf}.`
        );
      }
      if (typeof schema.minimum === 'number' && value < schema.minimum) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. ${value} should be at least ${schema.minimum}`
        );
      }
      if (
        typeof schema.exclusiveMinimum === 'number' &&
        value <= schema.exclusiveMinimum
      ) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. ${value} should be greater than ${schema.exclusiveMinimum}`
        );
      }
      if (typeof schema.maximum === 'number' && value > schema.maximum) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. ${value} should be at most ${schema.maximum}`
        );
      }
      if (
        typeof schema.exclusiveMaximum === 'number' &&
        value >= schema.exclusiveMaximum
      ) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. ${value} should be less than ${schema.exclusiveMaximum}`
        );
      }
    }

    if (schema.type === 'string') {
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. '${value}' should match the pattern '${schema.pattern}'.`
        );
      }

      if (
        typeof schema.minLength === 'number' &&
        value.length < schema.minLength
      ) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. '${value}' (${value.length} character(s)) should have at least ${schema.minLength} character(s).`
        );
      }

      if (
        typeof schema.maxLength === 'number' &&
        value.length > schema.maxLength
      ) {
        throw new SchemaError(
          `Property '${propName}' does not match the schema. '${value}' (${value.length} character(s)) should have at most ${schema.maxLength} character(s).`
        );
      }
    }
  } else if (Array.isArray(value)) {
    if (schema.type !== 'array') throwInvalidSchema(propName, schema);
    value.forEach((valueInArray) =>
      validateProperty(propName, valueInArray, schema.items || {}, definitions)
    );
  } else {
    if (schema.type !== 'object') throwInvalidSchema(propName, schema);
    validateObject(value, schema, definitions);
  }
}

/**
 * Unfortunately, due to use supporting Angular Devkit, we have to do the following
 * conversions.
 */
function normalizedPrimitiveType(type: string) {
  if (type === 'integer') return 'number';
  return type;
}

function throwInvalidSchema(propName: string, schema: any) {
  throw new SchemaError(
    `Property '${propName}' does not match the schema.\n${JSON.stringify(
      schema,
      null,
      2
    )}'`
  );
}

export function setDefaults(opts: { [k: string]: any }, schema: Schema) {
  setDefaultsInObject(opts, schema.properties || {}, schema.definitions || {});
  return opts;
}

function setDefaultsInObject(
  opts: { [k: string]: any },
  properties: Properties,
  definitions: Properties
) {
  Object.keys(properties).forEach((p) => {
    setPropertyDefault(opts, p, properties[p], definitions);
  });
}

function setPropertyDefault(
  opts: { [k: string]: any },
  propName: string,
  schema: any,
  definitions: Properties
) {
  if (schema.$ref) {
    schema = resolveDefinition(schema.$ref, definitions);
  }

  if (schema.type !== 'object' && schema.type !== 'array') {
    if (opts[propName] === undefined && schema.default !== undefined) {
      opts[propName] = schema.default;
    }
  } else if (schema.type === 'array') {
    const items = schema.items || {};
    if (
      opts[propName] &&
      Array.isArray(opts[propName]) &&
      items.type === 'object'
    ) {
      opts[propName].forEach((valueInArray) =>
        setDefaultsInObject(valueInArray, items.properties || {}, definitions)
      );
    } else if (!opts[propName] && schema.default) {
      opts[propName] = schema.default;
    }
  } else {
    const wasUndefined = opts[propName] === undefined;
    if (wasUndefined) {
      // We need an object to set values onto
      opts[propName] = {};
    }

    setDefaultsInObject(opts[propName], schema.properties || {}, definitions);

    // If the property was initially undefined but no properties were added, we remove it again instead of having an {}
    if (wasUndefined && Object.keys(opts[propName]).length === 0) {
      delete opts[propName];
    }
  }
}

function resolveDefinition(ref: string, definitions: Properties) {
  if (!ref.startsWith('#/definitions/')) {
    throw new Error(`$ref should start with "#/definitions/"`);
  }
  const definition = ref.split('#/definitions/')[1];
  if (!definitions[definition]) {
    throw new Error(`Cannot resolve ${ref}`);
  }
  return definitions[definition];
}

export function applyVerbosity(
  options: Record<string, unknown>,
  schema: Schema,
  isVerbose: boolean
) {
  if (
    (schema.additionalProperties === true || 'verbose' in schema.properties) &&
    isVerbose
  ) {
    options['verbose'] = true;
  }
}

export function combineOptionsForExecutor(
  commandLineOpts: Options,
  config: string,
  target: TargetConfiguration,
  schema: Schema,
  defaultProjectName: string | null,
  relativeCwd: string | null,
  isVerbose = false
) {
  const r = convertAliases(
    coerceTypesInOptions(convertToCamelCase(commandLineOpts, schema), schema),
    schema,
    false
  );
  let combined = target.options || {};
  if (config && target.configurations && target.configurations[config]) {
    Object.assign(combined, target.configurations[config]);
  }
  combined = convertAliases(combined, schema, false);
  Object.assign(combined, r);
  convertSmartDefaultsIntoNamedParams(
    combined,
    schema,
    defaultProjectName,
    relativeCwd
  );
  warnDeprecations(combined, schema);
  setDefaults(combined, schema);
  validateOptsAgainstSchema(combined, schema);
  applyVerbosity(combined, schema, isVerbose);
  return combined;
}

export async function combineOptionsForGenerator(
  commandLineOpts: Options,
  collectionName: string,
  generatorName: string,
  projectsConfigurations: ProjectsConfigurations,
  nxJsonConfiguration: NxJsonConfiguration,
  schema: Schema,
  isInteractive: boolean,
  defaultProjectName: string | null,
  relativeCwd: string | null,
  isVerbose = false
) {
  const generatorDefaults = projectsConfigurations
    ? getGeneratorDefaults(
        defaultProjectName,
        projectsConfigurations,
        nxJsonConfiguration,
        collectionName,
        generatorName
      )
    : {};
  let combined = convertAliases(
    coerceTypesInOptions({ ...generatorDefaults, ...commandLineOpts }, schema),
    schema,
    false
  );

  warnDeprecations(combined, schema);
  convertSmartDefaultsIntoNamedParams(
    combined,
    schema,
    defaultProjectName,
    relativeCwd
  );

  if (isInteractive && isTTY()) {
    combined = await promptForValues(combined, schema, projectsConfigurations);
  }

  setDefaults(combined, schema);
  validateOptsAgainstSchema(combined, schema);
  applyVerbosity(combined, schema, isVerbose);
  return combined;
}

export function warnDeprecations(
  opts: { [k: string]: any },
  schema: Schema
): void {
  Object.keys(opts).forEach((option) => {
    const deprecated = schema.properties[option]?.['x-deprecated'];
    if (deprecated) {
      logger.warn(
        `Option "${option}" is deprecated${
          typeof deprecated == 'string' ? ': ' + deprecated : '.'
        }`
      );
    }
  });
}

export function convertSmartDefaultsIntoNamedParams(
  opts: { [k: string]: any },
  schema: Schema,
  defaultProjectName: string | null,
  relativeCwd: string | null
) {
  const argv = opts['_'] || [];
  const usedPositionalArgs = {};
  Object.entries(schema.properties).forEach(([k, v]) => {
    if (
      opts[k] === undefined &&
      v.$default !== undefined &&
      v.$default.$source === 'argv' &&
      argv[v.$default.index]
    ) {
      usedPositionalArgs[v.$default.index] = true;
      opts[k] = coerceType(v, argv[v.$default.index]);
    } else if (v.$default !== undefined && v.$default.$source === 'unparsed') {
      opts[k] = opts['__overrides_unparsed__'] || [];
    } else if (
      opts[k] === undefined &&
      v.$default !== undefined &&
      v.$default.$source === 'projectName' &&
      defaultProjectName
    ) {
      opts[k] = defaultProjectName;
    } else if (
      opts[k] === undefined &&
      v.format === 'path' &&
      v.visible === false &&
      relativeCwd
    ) {
      opts[k] = relativeCwd.replace(/\\/g, '/');
    } else if (
      opts[k] === undefined &&
      v.$default !== undefined &&
      v.$default.$source === 'workingDirectory' &&
      relativeCwd
    ) {
      opts[k] = relativeCwd.replace(/\\/g, '/');
    }
  });
  const leftOverPositionalArgs = [];
  for (let i = 0; i < argv.length; ++i) {
    if (!usedPositionalArgs[i]) {
      leftOverPositionalArgs.push(argv[i]);
    }
  }
  if (leftOverPositionalArgs.length === 0) {
    delete opts['_'];
  } else {
    opts['_'] = leftOverPositionalArgs;
  }
  delete opts['__overrides_unparsed__'];
}

function getGeneratorDefaults(
  projectName: string | null,
  projectsConfigurations: ProjectsConfigurations,
  nxJsonConfiguration: NxJsonConfiguration,
  collectionName: string,
  generatorName: string
) {
  let defaults = {};
  if (nxJsonConfiguration?.generators) {
    if (nxJsonConfiguration.generators[collectionName]?.[generatorName]) {
      defaults = {
        ...defaults,
        ...nxJsonConfiguration.generators[collectionName][generatorName],
      };
    }
    if (nxJsonConfiguration.generators[`${collectionName}:${generatorName}`]) {
      defaults = {
        ...defaults,
        ...nxJsonConfiguration.generators[`${collectionName}:${generatorName}`],
      };
    }
  }
  if (
    projectName &&
    projectsConfigurations?.projects[projectName]?.generators
  ) {
    const g = projectsConfigurations.projects[projectName].generators;
    if (g[collectionName] && g[collectionName][generatorName]) {
      defaults = { ...defaults, ...g[collectionName][generatorName] };
    }
    if (g[`${collectionName}:${generatorName}`]) {
      defaults = {
        ...defaults,
        ...g[`${collectionName}:${generatorName}`],
      };
    }
  }
  return defaults;
}

type Prompt = ConstructorParameters<typeof import('enquirer').Prompt>[0] & {
  name: string;
  type: 'input' | 'autocomplete' | 'multiselect' | 'confirm' | 'numeral';
  message: string;
  initial?: any;
  limit?: number;
  choices?: (string | { name: string; message: string })[];
};

export function getPromptsForSchema(
  opts: Options,
  schema: Schema,
  projectsConfigurations: ProjectsConfigurations
): Prompt[] {
  const prompts: Prompt[] = [];
  Object.entries(schema.properties).forEach(([k, v]) => {
    if (v['x-prompt'] && opts[k] === undefined) {
      const question: Prompt = {
        name: k,
      } as any;

      if (v.default) {
        question.initial = v.default;
      }

      // Normalize x-prompt
      if (typeof v['x-prompt'] === 'string') {
        const message = v['x-prompt'];
        if (v.type === 'boolean') {
          v['x-prompt'] = {
            type: 'confirm',
            message,
          };
        } else if (v.type === 'array' && v.items?.enum) {
          v['x-prompt'] = {
            type: 'multiselect',
            items: v.items.enum,
            message,
          };
        } else {
          v['x-prompt'] = {
            type: 'input',
            message,
          };
        }
      }

      question.message = v['x-prompt'].message;
      question.validate = (s) => {
        try {
          validateProperty(k, s, v, schema.definitions || {});
          return true;
        } catch (e) {
          return e.message;
        }
      };

      // Limit the number of choices displayed so that the prompt fits on the screen
      const limitForChoicesDisplayed =
        process.stdout.rows - question.message.split('\n').length;

      if (v.type === 'string' && v.enum && Array.isArray(v.enum)) {
        question.type = 'autocomplete';
        question.choices = [...v.enum];
        question.limit = limitForChoicesDisplayed;
      } else if (
        v.type === 'string' &&
        (v.$default?.$source === 'projectName' ||
          k === 'project' ||
          k === 'projectName' ||
          v['x-dropdown'] === 'projects') &&
        projectsConfigurations
      ) {
        question.type = 'autocomplete';
        question.choices = Object.keys(projectsConfigurations.projects);
        question.limit = limitForChoicesDisplayed;
      } else if (v.type === 'number' || v['x-prompt'].type == 'number') {
        question.type = 'numeral';
      } else if (
        v['x-prompt'].type == 'confirmation' ||
        v['x-prompt'].type == 'confirm'
      ) {
        question.type = 'confirm';
      } else if (v['x-prompt'].items) {
        question.type =
          v['x-prompt'].multiselect || v.type === 'array'
            ? 'multiselect'
            : 'autocomplete';
        question.choices =
          v['x-prompt'].items &&
          v['x-prompt'].items.map((item) => {
            if (typeof item == 'string') {
              return item;
            } else {
              return {
                message: item.label,
                name: item.value,
              };
            }
          });
        question.limit = limitForChoicesDisplayed;
      } else if (v.type === 'boolean') {
        question.type = 'confirm';
      } else {
        question.type = 'input';
      }
      prompts.push(question);
    }
  });

  return prompts;
}

async function promptForValues(
  opts: Options,
  schema: Schema,
  projectsConfigurations: ProjectsConfigurations
) {
  return await (
    await import('enquirer')
  )
    .prompt(getPromptsForSchema(opts, schema, projectsConfigurations))
    .then((values) => ({ ...opts, ...values }))
    .catch((e) => {
      console.error(e);
      process.exit(0);
    });
}

function findSchemaForProperty(
  propName: string,
  schema: Schema
): { name: string; description: PropertyDescription } | null {
  if (propName in schema.properties) {
    return {
      name: propName,
      description: schema.properties[propName],
    };
  }
  const found = Object.entries(schema.properties).find(
    ([_, d]) =>
      d.alias === propName ||
      (Array.isArray(d.aliases) && d.aliases.includes(propName))
  );
  if (found) {
    const [name, description] = found;
    return { name, description };
  }
  return null;
}

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}

/**
 * Verifies whether the given value can be converted to a boolean
 * @param value
 */
function isConvertibleToBoolean(value) {
  if ('boolean' === typeof value) {
    return true;
  }

  if ('string' === typeof value && /true|false/.test(value)) {
    return true;
  }

  return false;
}

/**
 * Verifies whether the given value can be converted to a number
 * @param value
 */
function isConvertibleToNumber(value) {
  // exclude booleans explicitly
  if ('boolean' === typeof value) {
    return false;
  }

  return !isNaN(+value);
}
