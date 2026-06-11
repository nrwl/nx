import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../../project-graph/project-graph-builder';
export declare function buildExplicitDependencies(jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
}, ctx: CreateDependenciesContext): RawProjectGraphDependency[];
