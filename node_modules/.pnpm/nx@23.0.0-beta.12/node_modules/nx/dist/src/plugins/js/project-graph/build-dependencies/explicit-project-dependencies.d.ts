import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../../project-graph/project-graph-builder';
import { TargetProjectLocator } from './target-project-locator';
export declare function buildExplicitTypeScriptDependencies(ctx: CreateDependenciesContext, targetProjectLocator: TargetProjectLocator): RawProjectGraphDependency[];
