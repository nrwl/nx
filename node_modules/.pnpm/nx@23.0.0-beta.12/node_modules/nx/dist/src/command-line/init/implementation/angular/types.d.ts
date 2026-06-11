import { InitArgs } from '../../init-v1';
import type { TargetConfiguration } from '../../../../config/workspace-json-project-json';
export type Options = Pick<InitArgs, 'nxCloud' | 'integrated' | 'interactive' | 'cacheable'>;
export type AngularJsonConfigTargetConfiguration = Exclude<TargetConfiguration, 'command' | 'executor' | 'outputs' | 'dependsOn' | 'inputs'> & {
    builder: string;
};
export type AngularJsonProjectConfiguration = {
    root: string;
    sourceRoot: string;
    architect?: Record<string, AngularJsonConfigTargetConfiguration>;
};
export interface AngularJsonConfig {
    projects: Record<string, AngularJsonProjectConfiguration>;
    defaultProject?: string;
}
export type WorkspaceCapabilities = {
    eslintProjectConfigFile: boolean;
    test: boolean;
    karmaProjectConfigFile: boolean;
};
