import { HandlerResult } from './server';
export declare function handleHashGlob(globs: string[], exclude?: string[]): Promise<HandlerResult>;
export declare function handleHashMultiGlob(globs: string[][]): Promise<HandlerResult>;
