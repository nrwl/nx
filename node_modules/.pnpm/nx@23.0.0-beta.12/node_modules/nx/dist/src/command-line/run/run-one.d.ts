import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
export declare function runOne(cwd: string, args: {
    [k: string]: any;
}, extraTargetDependencies?: Record<string, (TargetDependencyConfig | string)[]>, extraOptions?: {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
}): Promise<void>;
export declare function parseRunOneOptions(cwd: string, parsedArgs: {
    [k: string]: any;
}, projectGraph: ProjectGraph, nxJson: NxJsonConfiguration): {
    project: any;
    target: any;
    configuration: any;
    parsedArgs: any;
};
