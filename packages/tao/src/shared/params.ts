import { strings } from '@angular-devkit/core';
import { ParsedArgs } from 'minimist';
import { TargetDefinition } from './workspace';

type Properties = {
  [p: string]: {
    type?: string;
    properties?: any;
    oneOf?: any;
    items?: any;
    alias?: string;
    description?: string;
    default?: string | number | boolean | string[];
  };
};
export type Schema = {
  properties: Properties;
  required?: string[];
  description?: string;
};

export type Unmatched = {
  name: string;
  possible: string[];
};

export type Options = {
  '--'?: Unmatched[];
  [k: string]: string | number | boolean | string[] | Unmatched[];
};

export async function handleErrors(
  logger: Console,
  isVerbose: boolean,
  fn: Function
) {
  try {
    return await fn();
  } catch (err) {
    if (err.constructor.name === 'UnsuccessfulWorkflowExecution') {
      logger.error('The Schematic workflow failed. See above.');
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
export function coerceTypes(opts: Options, schema: Schema): Options {
  Object.keys(opts).forEach((k) => {
    if (schema.properties[k] && schema.properties[k].type == 'boolean') {
      opts[k] = opts[k] === true || opts[k] === 'true';
    } else if (schema.properties[k] && schema.properties[k].type == 'number') {
      opts[k] = Number(opts[k]);
    } else if (schema.properties[k] && schema.properties[k].type == 'array') {
      opts[k] = opts[k].toString().split(',');
    }
  });
  return opts;
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
  validateObject(opts, schema.properties || {}, schema.required || []);
}

export function validateObject(
  opts: { [k: string]: any },
  properties: Properties,
  required: string[]
) {
  required.forEach((p) => {
    if (opts[p] === undefined) {
      throw new SchemaError(`Required property '${p}' is missing`);
    }
  });

  Object.keys(opts).forEach((p) => {
    validateProperty(p, opts[p], properties[p]);
  });
}

function validateProperty(propName: string, value: any, schema: any) {
  if (!schema) return;

  if (schema.oneOf) {
    if (!Array.isArray(schema.oneOf))
      throw new Error(`Invalid schema file. oneOf must be an array.`);

    let passes = false;
    schema.oneOf.forEach((r) => {
      try {
        validateProperty(propName, value, r);
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
      validateProperty(propName, valueInArray, schema.items || {})
    );
  } else {
    if (schema.type !== 'object') throwInvalidSchema(propName, schema);
    validateObject(value, schema.properties || {}, schema.required || []);
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
  setDefaultsInObject(opts, schema.properties);
  return opts;
}

function setDefaultsInObject(
  opts: { [k: string]: any },
  properties: Properties
) {
  Object.keys(properties).forEach((p) => {
    setPropertyDefault(opts, p, properties[p]);
  });
}

function setPropertyDefault(
  opts: { [k: string]: any },
  propName: string,
  schema: any
) {
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
        setDefaultsInObject(valueInArray, items.properties || {})
      );
    }
  } else {
    setDefaultsInObject(opts[propName], schema.properties);
  }
}

export function combineOptions(
  commandLineOpts: Options,
  config: string,
  target: TargetDefinition,
  schema: Schema
) {
  const r = convertAliases(coerceTypes(commandLineOpts, schema), schema, false);
  const configOpts =
    config && target.configurations ? target.configurations[config] || {} : {};
  const combined = { ...target.options, ...configOpts, ...r };
  setDefaults(combined, schema);
  validateOptsAgainstSchema(combined, schema);
  return combined;
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
        (p) => strings.levenshtein(p, unmatched.name) < 3
      );
    });
  }
  return opts;
}
