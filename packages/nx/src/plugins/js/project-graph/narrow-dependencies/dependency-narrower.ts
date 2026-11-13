import { join } from 'node:path';
import type { CreateDependenciesContext } from '@nx/devkit';
import { detectBundlersForProject } from '../bundlers';
import type { NormalizedOptions } from '../narrowing-options';
import type { RawDependency, TargetMatchData } from '../types';
import { AffectedDependencyAnalyzer } from './affected-dependency-analyzer';
import { ExportGraphResolver } from './export-graph-resolver';
import { FileCache } from './file-cache';
import { ImportUsageAnalyzer } from './import-usage-analyzer';
import { TargetMatchResolver } from './target-match-resolver';
import { TaskRunner } from './task-runner';

type ReexportEdge = {
  dep: RawDependency;
  reexportedNames: string[];
  isStarReexport: boolean;
  targetMatch: TargetMatchData;
};

type Phase1Result = {
  dep: RawDependency;
  keep: boolean | 'reexport-pending';
  reexport?: ReexportEdge;
};

export class DependencyNarrower {
  private readonly cache: FileCache;
  private readonly taskRunner: TaskRunner;
  private readonly targetMatchResolver: TargetMatchResolver;
  private readonly exportGraphResolver: ExportGraphResolver;
  private readonly importUsageAnalyzer: ImportUsageAnalyzer;
  private readonly affectedDependencyAnalyzer: AffectedDependencyAnalyzer;

  constructor(
    private readonly context: CreateDependenciesContext,
    private readonly options: NormalizedOptions
  ) {
    this.cache = new FileCache();
    this.taskRunner = new TaskRunner(this.options.concurrency);
    this.targetMatchResolver = new TargetMatchResolver(this.context.workspaceRoot);
    this.exportGraphResolver = new ExportGraphResolver(
      this.context.workspaceRoot,
      this.cache
    );
    this.importUsageAnalyzer = new ImportUsageAnalyzer(
      this.cache,
      this.exportGraphResolver
    );
    this.affectedDependencyAnalyzer = new AffectedDependencyAnalyzer(
      this.context.workspaceRoot,
      this.cache,
      this.importUsageAnalyzer,
      this.exportGraphResolver,
      this.taskRunner
    );
  }

  async narrow(dependencies: RawDependency[]): Promise<RawDependency[]> {
    const targetMatchMap = await this.targetMatchResolver.buildTargetMatchMap(
      this.context,
      this.options
    );

    const phase1Results = await this.taskRunner.map(
      dependencies,
      async (dep): Promise<Phase1Result> => {
        if (dep.type !== 'static' || !dep.sourceFile) {
          return { dep, keep: true };
        }

        if (dep.sourceFile.endsWith('package.json')) {
          return { dep, keep: false };
        }

        const targetMatch = targetMatchMap.get(dep.target);
        if (!targetMatch) {
          return { dep, keep: true };
        }

        if (this.options.respectSideEffects && targetMatch.sideEffects) {
          return { dep, keep: true };
        }

        const sourceProject = this.context.projects[dep.source];
        if (!sourceProject) {
          return { dep, keep: true };
        }

        const sourceFilePath = join(this.context.workspaceRoot, dep.sourceFile);
        if (!(await this.cache.exists(sourceFilePath))) {
          return { dep, keep: true };
        }

        const { ast: sourceAst, text: sourceText } =
          await this.cache.getOrParse(sourceFilePath);

        const importInsight = await this.importUsageAnalyzer.analyzeImportsForTarget({
          sourceAst,
          sourceText,
          sourceFilePath,
          targetMatch,
          removeTypeOnlyEdges: this.options.removeTypeOnlyEdges,
          resolveNamespaceImports: this.options.resolveNamespaceImports,
        });

        if (!importInsight.matched || importInsight.hasDynamicImport) {
          return { dep, keep: true };
        }

        if (this.options.mode === 'aggressive') {
          const bundlers = detectBundlersForProject(sourceProject);
          if (bundlers.length === 0 && !this.options.fallbackToStaticGraph) {
            return { dep, keep: true };
          }
        }

        if (importInsight.onlyReexports) {
          return {
            dep,
            keep: 'reexport-pending',
            reexport: {
              dep,
              reexportedNames: importInsight.reexportedNames,
              isStarReexport: importInsight.isStarReexport,
              targetMatch,
            },
          };
        }

        return { dep, keep: !importInsight.removable };
      }
    );

    const reexportEdges = phase1Results
      .map((result) => result.reexport)
      .filter((result): result is ReexportEdge => result !== undefined);

    const consumerImports = await this.buildConsumerImports(
      dependencies,
      reexportEdges,
      targetMatchMap
    );
    const reexportDecisions = await this.resolveReexportEdges(
      reexportEdges,
      dependencies,
      consumerImports,
      targetMatchMap
    );

    const keptEdges = phase1Results
      .filter(({ dep, keep }) => {
        if (keep === 'reexport-pending') {
          return reexportDecisions.get(dep) ?? true;
        }

        return keep;
      })
      .map(({ dep }) => dep);

    if (!this.options.affectedNarrowing) {
      return keptEdges;
    }

    return this.affectedDependencyAnalyzer.applyAffectedNarrowing(
      keptEdges,
      this.context,
      targetMatchMap,
      this.options
    );
  }

  private async buildConsumerImports(
    dependencies: RawDependency[],
    reexportEdges: ReexportEdge[],
    targetMatchMap: Map<string, TargetMatchData>
  ): Promise<Map<string, Map<string, Set<string>>>> {
    const consumerImports = new Map<string, Map<string, Set<string>>>();

    if (reexportEdges.length === 0) {
      return consumerImports;
    }

    const consumerResults = await this.taskRunner.map(
      dependencies.filter(
        (dep) =>
          dep.type === 'static' &&
          dep.sourceFile &&
          !dep.sourceFile.endsWith('package.json')
      ),
      async (dep) => {
        const sourceFile = dep.sourceFile;
        if (!sourceFile) {
          return;
        }

        const sourceFilePath = join(this.context.workspaceRoot, sourceFile);
        if (!(await this.cache.exists(sourceFilePath))) {
          return;
        }

        const targetMatch = targetMatchMap.get(dep.target);
        if (!targetMatch) {
          return;
        }

        const { ast: sourceAst } = await this.cache.getOrParse(sourceFilePath);
        const importedNames = this.importUsageAnalyzer.collectImportedNamesForTarget(
          sourceAst,
          targetMatch,
          this.options.resolveNamespaceImports
        );

        if (importedNames.size === 0) {
          return;
        }

        return { source: dep.source, target: dep.target, importedNames };
      }
    );

    for (const result of consumerResults) {
      if (!result) {
        continue;
      }

      const projectMap =
        consumerImports.get(result.source) ?? new Map<string, Set<string>>();
      consumerImports.set(result.source, projectMap);

      const names = projectMap.get(result.target) ?? new Set<string>();
      projectMap.set(result.target, names);

      for (const name of result.importedNames) {
        names.add(name);
      }
    }

    return consumerImports;
  }

  private async resolveReexportEdges(
    reexportEdges: ReexportEdge[],
    allDependencies: RawDependency[],
    consumerImports: Map<string, Map<string, Set<string>>>,
    targetMatchMap: Map<string, TargetMatchData>
  ): Promise<Map<RawDependency, boolean>> {
    const decisions = new Map<RawDependency, boolean>();
    if (reexportEdges.length === 0) {
      return decisions;
    }

    const consumersOf = new Map<string, Set<string>>();
    for (const dep of allDependencies) {
      if (dep.type !== 'static') {
        continue;
      }

      const consumers = consumersOf.get(dep.target) ?? new Set<string>();
      consumers.add(dep.source);
      consumersOf.set(dep.target, consumers);
    }

    const results = await this.taskRunner.map(reexportEdges, async (edge) => {
      const consumers = consumersOf.get(edge.dep.source);
      if (!consumers || consumers.size === 0) {
        return { dep: edge.dep, keep: false };
      }

      const relevantSymbols = edge.isStarReexport
        ? await this.exportGraphResolver.resolveTargetExportedSymbols(
            edge.targetMatch,
            targetMatchMap
          )
        : new Set(edge.reexportedNames);

      if (!relevantSymbols) {
        return { dep: edge.dep, keep: true };
      }

      return {
        dep: edge.dep,
        keep: this.exportGraphResolver.anyConsumerUsesSymbols(
          edge.dep.source,
          relevantSymbols,
          consumersOf,
          consumerImports,
          new Set<string>()
        ),
      };
    });

    for (const result of results) {
      decisions.set(result.dep, result.keep);
    }

    return decisions;
  }
}