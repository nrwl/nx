import { Argv, CommandModule } from 'yargs';
export declare const yargsGraphCommand: CommandModule;
export declare function withGraphOptions(yargs: Argv): Argv<{
    file: string;
} & {
    print: boolean;
} & {
    view: string;
} & {
    targets: string;
} & {
    focus: string;
} & {
    exclude: string;
} & {
    groupByFolder: boolean;
} & {
    host: string;
} & {
    port: number;
} & {
    watch: boolean;
} & {
    open: boolean;
}>;
