import { logging } from '@angular-devkit/core';
import { UnsuccessfulWorkflowExecution } from '@angular-devkit/schematics';

export type Schema = {
  properties: { [p: string]: any };
  required: string[];
  description: string;
};

export async function handleErrors(logger: logging.Logger, fn: Function) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnsuccessfulWorkflowExecution) {
      logger.fatal('The Schematic workflow failed. See above.');
    } else {
      logger.fatal(err.message);
    }
    return 1;
  }
}

export function convertToCamelCase(parsed: {
  [k: string]: any;
}): { [k: string]: any } {
  return Object.keys(parsed).reduce(
    (m, c) => ({ ...m, [camelCase(c)]: parsed[c] }),
    {}
  );
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

export function coerceTypes(opts: { [k: string]: any }, schema: Schema) {
  Object.keys(opts).forEach(k => {
    if (schema.properties[k] && schema.properties[k].type == 'boolean') {
      opts[k] = opts[k] === true || opts[k] === 'true';
    } else if (schema.properties[k] && schema.properties[k].type == 'number') {
      opts[k] = Number(opts[k]);
    }
  });
  return opts;
}

export function convertAliases(opts: { [k: string]: any }, schema: Schema) {
  return Object.keys(opts).reduce((acc, k) => {
    if (schema.properties[k]) {
      acc[k] = opts[k];
    } else {
      const found = Object.entries(schema.properties).find(
        ([_, d]) => d.alias === k
      );
      if (found) {
        acc[found[0]] = opts[k];
      }
    }
    return acc;
  }, {});
}
