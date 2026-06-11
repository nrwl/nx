import { CommandModule } from 'yargs';
export interface ConfigureAiAgentsOptions {
    agents?: string[];
    interactive?: boolean;
    verbose?: boolean;
    check?: boolean | 'outdated' | 'all';
}
export declare const yargsConfigureAiAgentsCommand: CommandModule<{}, ConfigureAiAgentsOptions>;
