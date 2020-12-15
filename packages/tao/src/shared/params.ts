import { ParsedArgs } from 'minimist';
import { TargetConfiguration, WorkspaceConfiguration } from './workspace';
import * as inquirer from 'inquirer';
import { logger } from './logger';

type PropertyDescription = {
  type?: string;
  properties?: any;
  oneOf?: any;
  items?: any;
  alias?: string;
  description?: string;
  default?: string | number | boolean | string[];
  $ref?: string;
  $default?: { $source: 'argv'; index: number };
  'x-prompt'?: string | { message: string; type: string; items: any[] };
};

type Properties = {
  [p: string]: PropertyDescription;
};
export type Schema = {
  properties: Properties;
  required?: string[];
  description?: string;
  definitions?: Properties;
};

export type Unmatched = {
  name: string;
  possible: string[];
};

export type Options = {
  '--'?: Unmatched[];
  [k: string]: string | number | boolean | string[] | Unmatched[];
};

export async function handleErrors(isVerbose: boolean, fn: Function) {
  try {
    return await fn();
  } catch (err) {
    if (err.constructor.name === 'UnsuccessfulWorkflowExecution') {
      logger.error('The generator workflow failed. See above.');
    } else {
      logger.error(err.message);
    }
    if (isVerbose && err.stack) {
      logger.info(err.stack);
    }
    return 1;
  }
}

function camelCase(input: string): string {
  if (input.indexOf('-') > 1) {
    return input
      .toLowerCase()
      .replace(/-(.)/g, (match, group1) => group1.toUpperCase());
  } else {
    return input;
  }
}

export function convertToCamelCase(parsed: ParsedArgs): Options {
  return Object.keys(parsed).reduce(
    (m, c) => ({ ...m, [camelCase(c)]: parsed[c] }),
    {}
  );
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
    opts[k] = coerceType(schema.properties[k], opts[k]);
  });
  return opts;
}

function coerceType(prop: PropertyDescription | undefined, value: any) {
  if (!prop) return value;
  if (prop.oneOf) {
    for (let i = 0; i < prop.oneOf.length; ++i) {
      const coerced = coerceType(prop.oneOf[i], value);
      if (coerced !== value) {
        return coerced;
      }
    }
    return value;
  } else if (prop.type == 'boolean') {
    return value === true || value == 'true';
  } else if (prop.type == 'number') {
    return Number(value);
  } else if (prop.type == 'array') {
    return value
      .toString()
      .split(',')
      .map((v) => coerceType(prop.items, v));
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
    if (schema.properties[k]) {
      acc[k] = opts[k];
    } else {
      const found = Object.entries(schema.properties).find(
        ([_, d]) => d.alias === k
      );
      if (found) {
        acc[found[0]] = opts[k];
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
  validateObject(
    opts,
    schema.properties || {},
    schema.required || [],
    schema.definitions || {}
  );
}

export function validateObject(
  opts: { [k: string]: any },
  properties: Properties,
  required: string[],
  definitions: Properties
) {
  required.forEach((p) => {
    if (opts[p] === undefined) {
      throw new SchemaError(`Required property '${p}' is missing`);
    }
  });

  Object.keys(opts).forEach((p) => {
    validateProperty(p, opts[p], properties[p], definitions);
  });
}

function validateProperty(
  propName: string,
  value: any,
  schema: any,
  definitions: Properties
) {
  if (!schema) return;

  if (schema.$ref) {
    schema = resolveDefinition(schema.$ref, definitions);
  }

  if (schema.oneOf) {
    if (!Array.isArray(schema.oneOf))
      throw new Error(`Invalid schema file. oneOf must be an array.`);

    let passes = false;
    schema.oneOf.forEach((r) => {
      try {
        validateProperty(propName, value, r, definitions);
        passes = true;
      } catch (e) {}
    });
    if (!passes) throwInvalidSchema(propName, schema);
    return;
  }

  const isPrimitive = typeof value !== 'object';
  if (isPrimitive) {
    if (typeof value !== schema.type) {
      throw new SchemaError(
        `Property '${propName}' does not match the schema. '${value}' should be a '${schema.type}'.`
      );
    }
  } else if (Array.isArray(value)) {
    if (schema.type !== 'array') throwInvalidSchema(propName, schema);
    value.forEach((valueInArray) =>
      validateProperty(propName, valueInArray, schema.items || {}, definitions)
    );
  } else {
    if (schema.type !== 'object') throwInvalidSchema(propName, schema);
    validateObject(
      value,
      schema.properties || {},
      schema.required || [],
      definitions
    );
  }
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
    if (!opts[propName]) {
      opts[propName] = {};
    }
    setDefaultsInObject(opts[propName], schema.properties || {}, definitions);
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

export function convertPositionParamsIntoNamedParams(
  opts: { [k: string]: any },
  schema: Schema,
  argv: string[]
) {
  Object.entries(schema.properties).forEach(([k, v]) => {
    if (
      opts[k] === undefined &&
      v.$default !== undefined &&
      argv[v.$default.index]
    ) {
      opts[k] = coerceType(v, argv[v.$default.index]);
    }
  });
  delete opts['_'];
}

export function combineOptionsForExecutor(
  commandLineOpts: Options,
  config: string,
  target: TargetConfiguration,
  schema: Schema
) {
  const r = convertAliases(
    coerceTypesInOptions(commandLineOpts, schema),
    schema,
    false
  );
  const configOpts =
    config && target.configurations ? target.configurations[config] || {} : {};
  const combined = { ...target.options, ...configOpts, ...r };
  convertPositionParamsIntoNamedParams(
    combined,
    schema,
    (commandLineOpts['_'] as string[]) || []
  );
  setDefaults(combined, schema);
  validateOptsAgainstSchema(combined, schema);
  return combined;
}

export async function combineOptionsForGenerator(
  commandLineOpts: Options,
  collectionName: string,
  generatorName: string,
  ws: WorkspaceConfiguration | null,
  schema: Schema,
  isInteractive: boolean
) {
  const generatorDefaults = ws
    ? getGeneratorDefaults(ws, collectionName, generatorName)
    : {};
  let combined = convertAliases(
    coerceTypesInOptions({ ...generatorDefaults, ...commandLineOpts }, schema),
    schema,
    false
  );
  convertPositionParamsIntoNamedParams(
    combined,
    schema,
    (commandLineOpts['_'] as string[]) || []
  );
  if (isInteractive && isTTY()) {
    combined = await promptForValues(combined, schema);
  }
  setDefaults(combined, schema);
  validateOptsAgainstSchema(combined, schema);
  return combined;
}

function getGeneratorDefaults(
  ws: WorkspaceConfiguration,
  collectionName: string,
  generatorName: string
) {
  if (!ws.generators) return {};

  let defaults = {};
  if (
    ws.generators[collectionName] &&
    ws.generators[collectionName][generatorName]
  ) {
    defaults = { ...defaults, ...ws.generators[collectionName][generatorName] };
  }
  if (ws.generators[`${collectionName}:${generatorName}`]) {
    defaults = {
      ...defaults,
      ...ws.generators[`${collectionName}:${generatorName}`],
    };
  }
  return defaults;
}

async function promptForValues(opts: Options, schema: Schema) {
  const prompts = [];
  Object.entries(schema.properties).forEach(([k, v]) => {
    if (v['x-prompt'] && opts[k] === undefined) {
      const question = {
        name: k,
        default: v.default,
      } as any;

      if (typeof v['x-prompt'] === 'string') {
        question.message = v['x-prompt'];
        question.type = v.type === 'boolean' ? 'confirm' : 'string';
      } else if (
        v['x-prompt'].type == 'confirmation' ||
        v['x-prompt'].type == 'confirm'
      ) {
        question.message = v['x-prompt'].message;
        question.type = 'confirm';
      } else {
        question.message = v['x-prompt'].message;
        question.type = 'list';
        question.choices =
          v['x-prompt'].items &&
          v['x-prompt'].items.map((item) => {
            if (typeof item == 'string') {
              return item;
            } else {
              return {
                name: item.label,
                value: item.value,
              };
            }
          });
      }
      prompts.push(question);
    }
  });

  return await inquirer
    .prompt(prompts)
    .then((values) => ({ ...opts, ...values }));
}

/**
 * Tries to find what the user meant by unmatched commands
 *
 * @param opts The options passed in by the user
 * @param schema The schema definition to check against
 *
 */
export function lookupUnmatched(opts: Options, schema: Schema): Options {
  if (opts['--']) {
    const props = Object.keys(schema.properties);

    opts['--'].forEach((unmatched) => {
      unmatched.possible = props.filter(
        (p) => levenshtein(p, unmatched.name) < 3
      );
    });
  }
  return opts;
}

function levenshtein(a: string, b: string) {
  if (a.length == 0) {
    return b.length;
  }
  if (b.length == 0) {
    return a.length;
  }
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function isTTY(): boolean {
  return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}
