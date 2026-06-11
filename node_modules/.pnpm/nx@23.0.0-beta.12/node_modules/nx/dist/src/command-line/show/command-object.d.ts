import { CommandModule } from 'yargs';
import type { ProjectGraphProjectNode } from '../../config/project-graph';
export interface NxShowArgs {
    json?: boolean;
}
export type ShowProjectsOptions = NxShowArgs & {
    exclude?: string[];
    files?: string;
    uncommitted?: any;
    untracked?: any;
    base?: string;
    head?: string;
    affected?: boolean;
    type?: ProjectGraphProjectNode['type'];
    projects?: string[];
    withTarget?: string[];
    verbose?: boolean;
    sep?: string;
};
export type ShowProjectOptions = NxShowArgs & {
    projectName?: string;
    web?: boolean;
    open?: boolean;
    verbose?: boolean;
};
export type ShowTargetBaseOptions = NxShowArgs & {
    target?: string;
    configuration?: string;
    verbose?: boolean;
};
export type ShowTargetInputsOptions = NxShowArgs & {
    target?: string;
    configuration?: string;
    check?: string[];
    verbose?: boolean;
};
export type ShowTargetOutputsOptions = ShowTargetBaseOptions & {
    check?: string[];
};
export declare const yargsShowCommand: CommandModule<Record<string, unknown>, NxShowArgs>;
