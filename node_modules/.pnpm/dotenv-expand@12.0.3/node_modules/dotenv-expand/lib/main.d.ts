// TypeScript Version: 3.0
/// <reference types="node" />

export interface DotenvPopulateInput {
  [name: string]: string;
}

export interface DotenvParseInput {
  [name: string]: string;
}

export interface DotenvParseOutput {
  [name: string]: string;
}

export interface DotenvExpandOptions {
  error?: Error;

  /**
   * Default: `process.env`
   *
   * Specify an object to write your secrets to. Defaults to process.env environment variables.
   *
   * example: `const processEnv = {}; require('dotenv').config({ processEnv: processEnv })`
   */
  processEnv?: DotenvPopulateInput;

  /**
   * Default: `object`
   *
   * Object coming from dotenv's parsed result.
   */
  parsed?: DotenvParseInput;
}

export interface DotenvExpandOutput {
  error?: Error;
  parsed?: DotenvParseOutput;
}

/**
 * Adds variable expansion on top of dotenv.
 *
 * See https://docs.dotenv.org
 *
 * @param options - additional options. example: `{ processEnv: {}, error: null, parsed: { { KEY: 'value' } }`
 * @returns an object with a `parsed` key if successful or `error` key if an error occurred. example: { parsed: { KEY: 'value' } }
 *
 */
export function expand(options?: DotenvExpandOptions): DotenvExpandOutput
