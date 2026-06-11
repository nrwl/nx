import { HandlerResult } from './server';
export declare function handleGlob(globs: string[], exclude?: string[]): Promise<HandlerResult>;
export declare function handleMultiGlob(globs: string[], exclude?: string[]): Promise<HandlerResult>;
