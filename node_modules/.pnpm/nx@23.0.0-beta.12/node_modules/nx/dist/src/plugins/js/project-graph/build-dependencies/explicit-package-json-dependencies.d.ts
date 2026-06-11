import type { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { type RawProjectGraphDependency } from '../../../../project-graph/project-graph-builder';
import { TargetProjectLocator } from './target-project-locator';
export declare function buildExplicitPackageJsonDependencies(ctx: CreateDependenciesContext, targetProjectLocator: TargetProjectLocator): RawProjectGraphDependency[];
