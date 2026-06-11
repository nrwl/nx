import { CreateNodesContextV2, CreateNodesResult } from './public-api';
export declare function createNodesFromFiles<T = unknown>(createNodes: (projectConfigurationFile: string, options: T | undefined, context: CreateNodesContextV2 & {
    configFiles: readonly string[];
}, idx: number) => CreateNodesResult | Promise<CreateNodesResult>, configFiles: readonly string[], options: T, context: CreateNodesContextV2): Promise<[file: string, value: CreateNodesResult][]>;
