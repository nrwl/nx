import { Schema } from './params';
export declare function printHelp(header: string, schema: Schema, meta: {
    mode: 'generate';
    plugin: string;
    entity: string;
    aliases: string[];
} | {
    mode: 'run';
    plugin: string;
    entity: string;
}): void;
