import type { Options } from './types';
export declare function getLegacyMigrationFunctionIfApplicable(repoRoot: string, options: Options): Promise<() => Promise<void> | null>;
