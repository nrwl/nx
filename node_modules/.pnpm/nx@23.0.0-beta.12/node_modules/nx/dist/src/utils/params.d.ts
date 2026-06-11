import type { NxJsonConfiguration } from '../config/nx-json';
import type { ProjectsConfigurations, TargetConfiguration } from '../config/workspace-json-project-json';
type PropertyDescription = {
    type?: string | string[];
    required?: string[];
    enum?: string[];
    properties?: Properties;
    oneOf?: PropertyDescription[];
    anyOf?: PropertyDescription[];
    allOf?: PropertyDescription[];
    items?: PropertyDescription | PropertyDescription[];
    additionalItems?: boolean | PropertyDescription;
    alias?: string;
    aliases?: string[];
    description?: string;
    format?: string;
    visible?: boolean;
    hidden?: boolean;
    default?: string | number | boolean | string[] | {
        [key: string]: string | number | boolean | string[];
    };
    $ref?: string;
    $default?: {
        $source: 'argv';
        index: number;
    } | {
        $source: 'projectName';
    } | {
        $source: 'unparsed';
    } | {
        $source: 'workingDirectory';
    };
    additionalProperties?: boolean | PropertyDescription;
    const?: any;
    'x-prompt'?: string | {
        message: string;
        type: string;
        items?: any[];
        multiselect?: boolean;
    };
    'x-deprecated'?: boolean | string;
    'x-dropdown'?: 'projects';
    'x-priority'?: 'important' | 'internal';
    multipleOf?: number;
    minimum?: number;
    exclusiveMinimum?: number;
    maximum?: number;
    exclusiveMaximum?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    minItems?: number;
    maxItems?: number;
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
    examples?: {
        command: string;
        description?: string;
    }[];
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
export declare function convertToCamelCase(parsed: {
    [k: string]: any;
}, schema: Schema): Options;
/**
 * Coerces (and replaces) options identified as 'boolean' or 'number' in the Schema
 *
 * @param opts The options to check
 * @param schema The schema definition with types to check against
 *
 */
export declare function coerceTypesInOptions(opts: Options, schema: Schema): Options;
/**
 * Converts any options passed in with short aliases to their full names if found
 * Unmatched options are added to opts['--']
 *
 * @param opts The options passed in by the user
 * @param schema The schema definition to check against
 */
export declare function convertAliases(opts: Options, schema: Schema, excludeUnmatched: boolean): Options;
export declare class SchemaError {
    readonly message: string;
    constructor(message: string);
}
export declare function validateOptsAgainstSchema(opts: {
    [k: string]: any;
}, schema: Schema): void;
export declare function validateObject(opts: {
    [p: string]: any;
}, schema: Schema | PropertyDescription, definitions: Properties): void;
export declare function setDefaults(opts: {
    [k: string]: any;
}, schema: Schema): {
    [k: string]: any;
};
export declare function applyVerbosity(options: Record<string, unknown>, schema: Schema, isVerbose: boolean): void;
export declare function combineOptionsForExecutor(commandLineOpts: Options, config: string, target: TargetConfiguration, schema: Schema, defaultProjectName: string | null, relativeCwd: string | null, isVerbose?: boolean): any;
export declare function combineOptionsForGenerator(commandLineOpts: Options, collectionName: string, generatorName: string, projectsConfigurations: ProjectsConfigurations, nxJsonConfiguration: NxJsonConfiguration, schema: Schema, isInteractive: boolean, defaultProjectName: string | null, relativeCwd: string | null, isVerbose?: boolean): Promise<Options>;
export declare function warnDeprecations(opts: {
    [k: string]: any;
}, schema: Schema): void;
export declare function convertSmartDefaultsIntoNamedParams(opts: {
    [k: string]: any;
}, schema: Schema, defaultProjectName: string | null, relativeCwd: string | null): void;
type Prompt = ConstructorParameters<typeof import('enquirer').Prompt>[0] & {
    name: string;
    type: 'input' | 'autocomplete' | 'multiselect' | 'confirm' | 'numeral';
    message: string;
    initial?: any;
    limit?: number;
    choices?: (string | {
        name: string;
        message: string;
    })[];
};
export declare function getPromptsForSchema(opts: Options, schema: Schema, projectsConfigurations: ProjectsConfigurations): Prompt[];
export {};
