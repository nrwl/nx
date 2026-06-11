import { Argv, ParserConfigurationOptions } from 'yargs';
interface ExcludeOptions {
    exclude: string[];
}
export declare const defaultYargsParserConfiguration: Partial<ParserConfigurationOptions>;
export declare function withExcludeOption<T>(yargs: Argv<T>): Argv<T & ExcludeOptions>;
export interface RunOptions {
    exclude: string;
    parallel: string;
    maxParallel: number;
    runner: string;
    prod: boolean;
    graph: string;
    verbose: boolean;
    nxBail: boolean;
    nxIgnoreCycles: boolean;
    skipNxCache: boolean;
    skipRemoteCache: boolean;
    cloud: boolean;
    dte: boolean;
    batch: boolean;
    useAgents: boolean;
    excludeTaskDependencies: boolean;
    skipSync: boolean;
}
export interface TuiOptions {
    tuiAutoExit: boolean | number;
    tui: boolean;
}
export declare function withTuiOptions<T>(yargs: Argv<T>): Argv<T & TuiOptions>;
export declare function withRunOptions<T>(yargs: Argv<T>): Argv<T & RunOptions>;
export declare function withTargetAndConfigurationOption(yargs: Argv, demandOption?: boolean): Argv<{
    configuration: string;
} & {
    targets: string;
}>;
export declare function withConfiguration(yargs: Argv): Argv<{
    configuration: string;
}>;
export declare function withVerbose<T>(yargs: Argv<T>): Argv<T & {
    verbose: boolean;
}>;
export declare function withBatch(yargs: Argv): any;
export declare function withAffectedOptions(yargs: Argv): Argv<ExcludeOptions & {
    files: string;
} & {
    stdin: boolean;
} & {
    uncommitted: boolean;
} & {
    untracked: boolean;
} & {
    base: string;
} & {
    head: string;
}>;
export interface RunManyOptions extends RunOptions {
    projects: string[];
    /**
     * @deprecated This is deprecated
     */
    all: boolean;
}
export declare function withRunManyOptions<T>(yargs: Argv<T>): Argv<T & RunManyOptions>;
export declare function withOverrides<T extends {
    _: Array<string | number>;
}>(args: T, commandLevel?: number): T & {
    __overrides_unparsed__: string[];
};
declare const allOutputStyles: readonly ["tui", "dynamic", "dynamic-legacy", "static", "stream", "stream-without-prefixes"];
export type OutputStyle = (typeof allOutputStyles)[number];
export declare function withOutputStyleOption<T>(yargs: Argv<T>, choices?: ReadonlyArray<OutputStyle>): Argv<T & {
    outputStyle: OutputStyle;
}>;
export declare function withRunOneOptions(yargs: Argv): Argv<{
    configuration: string;
} & {
    outputStyle: OutputStyle;
} & RunOptions & {
    project: string;
} & {
    target: string;
} & {
    help: boolean;
}>;
export declare function parseNewlines(input: string): string[];
export declare function parseCSV(args: string[] | string): string[];
export declare function readParallelFromArgsAndEnv(args: {
    [k: string]: any;
}): number;
export {};
