import type { FluffTarget } from './FluffTarget.js';

export interface FluffConfig
{
    version: string;
    targets: Record<string, FluffTarget>;
    defaultTarget?: string;
}
