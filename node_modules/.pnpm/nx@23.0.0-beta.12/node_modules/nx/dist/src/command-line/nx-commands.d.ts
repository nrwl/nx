import * as yargs from 'yargs';
export declare const parserConfiguration: Partial<yargs.ParserConfigurationOptions>;
/**
 * Exposing the Yargs commands object so the documentation generator can
 * parse it. The CLI will consume it and call the `.argv` to bootstrapped
 * the CLI. These command declarations needs to be in a different file
 * from the `.argv` call, so the object and it's relative scripts can
 * be executed correctly.
 */
export declare const commandsObject: yargs.Argv<unknown>;
