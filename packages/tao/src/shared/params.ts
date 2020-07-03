import { logging, strings } from '@angular-devkit/core';
import { UnsuccessfulWorkflowExecution } from '@angular-devkit/schematics';
import { ParsedArgs } from 'minimist';

export type Schema = {
  properties: {
    [p: string]: {
      type: string;
      alias?: string;
      description?: string;
      default?: string | number | boolean | string[];
    };
  };
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
  logger: logging.Logger,
  isVerbose: boolean,
  fn: Function
) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnsuccessfulWorkflowExecution) {
      logger.fatal('The Schematic workflow failed. See above.');
    } else {
      logger.fatal(err.message);
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
