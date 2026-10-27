import type { ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';
import { type FileMapCache, findMatchingProjects } from '@nx/devkit/internal';
import {
  ConformanceTree,
  convertToReadOnly,
  convertToWritable,
} from './conformance-tree';
import type { SuccessfulResolveRuleResultData } from './resolve-rule';
import type {
  ConformanceRuleFixGenerator,
  ConformanceRuleResultSeverity,
  ConformanceRuleResultWithRuleAndRunnerData,
  ConformanceViolation,
  FixGeneratorData,
  RuleStatus,
} from './types';

export async function conformanceRulesRunner({
  tree,
  projectGraph,
  fileMapCache,
  loadedRules,
  applyFixGenerators,
}: {
  tree: ConformanceTree;
  projectGraph: ProjectGraph;
  fileMapCache: FileMapCache;
  loadedRules: SuccessfulResolveRuleResultData[];
  applyFixGenerators: boolean;
}): Promise<{
  ruleResults: ConformanceRuleResultWithRuleAndRunnerData[];
}> {
  if (!loadedRules.length) {
    return {
      ruleResults: [],
    };
  }

  const findMatchingProjectsCache = new Map<string, string[]>();
  const memoizedFindMatchingProjects = (
    matchers: string[],
    projects: Record<string, ProjectGraphProjectNode>
  ) => {
    // Sort for a consistent cache key
    const cacheKey = matchers.sort().join(',');
    if (findMatchingProjectsCache.has(cacheKey)) {
      return findMatchingProjectsCache.get(cacheKey) as string[];
    }
    const result = findMatchingProjects(matchers, projects);
    findMatchingProjectsCache.set(cacheKey, result);
    return result;
  };

  type DiagnosticPhaseContext = {
    finalResult: ConformanceRuleResultWithRuleAndRunnerData;
    hasFixGenerator: boolean;
    fixGenerator?: ConformanceRuleFixGenerator<FixGeneratorData>;
    originalViolations?: ConformanceViolation[];
    ruleOptions?: Record<string, unknown>;
    detailsFixGeneratorData?: FixGeneratorData;
    // Tracks if any violation included fixGeneratorData so we can skip an unnecessary strip loop
    hasAnyViolationFixGeneratorData?: boolean;
    // NOTE: disabled rules skip implementation and fixes
    resolvedStatus: RuleStatus;
  };

  // Build a global file -> project index for O(1) inference during diagnostics
  const projectFileMap = fileMapCache.fileMap.projectFileMap as Record<
    string,
    { file: string }[]
  >;
  const fileToProject = new Map<string, string>();
  for (const [projectName, files] of Object.entries(projectFileMap)) {
    for (const fileData of files) {
      const filePath = fileData.file;
      if (filePath && !fileToProject.has(filePath)) {
        fileToProject.set(filePath, projectName);
      }
    }
  }

  // Diagnostic phase: evaluate rules and build base results and contexts
  const diagnosticResults: DiagnosticPhaseContext[] = await Promise.all(
    loadedRules.map(
      async ({
        ruleSpecifier,
        ruleModule,
        ruleOptions,
        projects,
        status,
        scheduledStatus,
        scheduledStatusDate,
      }) => {
        // Default to "enforced" if no status is specified (e.g. if not explicitly in nx.json config)
        status = status ?? 'enforced';

        // Only applicable to Nx Cloud Enterprise users
        scheduledStatus = scheduledStatus ?? null;
        scheduledStatusDate = scheduledStatusDate ?? null;

        // Resolve the final status of the rule for the current execution of the runner to form the source of truth for the report
        const resolvedStatus = resolveFinalRuleStatus(status, {
          scheduledStatus,
          scheduledStatusDate,
        });

        const { implementation, fixGenerator, ...ruleData } = ruleModule;
        const hasFixGenerator = typeof fixGenerator === 'function';
        const fixGeneratorStatus = hasFixGenerator
          ? ('not-applied' as const)
          : ('no-fix-generator' as const);

        if (resolvedStatus === 'disabled') {
          const finalResult: ConformanceRuleResultWithRuleAndRunnerData = {
            /**
             * Setting any standard value for severity in this case is misleading, as the rule has
             * intentionally not been executed, therefore forcibly set the value to null.
             */
            severity: null as unknown as ConformanceRuleResultSeverity,
            details: { violations: [] },
            ruleSpecifier,
            ruleData,
            resolvedStatus,
            runnerData: {
              status,
              scheduledStatus: scheduledStatus ?? null,
              scheduledStatusDate: scheduledStatusDate ?? null,
              fixGeneratorStatus,
              countOfOriginalViolations: 0,
              countOfViolationsFixedByGenerator: 0,
              countOfViolationsFilteredByProjects: 0,
              executionTimeMs: 0,
            },
          };

          return {
            finalResult,
            hasFixGenerator,
            resolvedStatus,
          } as DiagnosticPhaseContext;
        }

        const startTime = performance.now();
        const ruleResult = await implementation({
          // Ensure the tree is read-only within the rule implementation
          tree: convertToReadOnly(tree),
          projectGraph,
          fileMapCache,
          ruleOptions,
        });
        const endTime = performance.now();

        const countOfOriginalViolations =
          ruleResult.details.violations?.length ?? 0;
        let hasAnyViolationFixGeneratorData = false;
        if (ruleResult.details.violations) {
          const violations = ruleResult.details.violations;
          const processedViolations: ConformanceViolation[] = [];

          // Extract the list of matchers from the support config styles
          const projectMatchers =
            projects?.map((p) => (typeof p === 'string' ? p : p.matcher)) ?? [];

          const allowedProjectNames =
            projectMatchers.length > 0
              ? new Set(
                  memoizedFindMatchingProjects(
                    projectMatchers,
                    projectGraph.nodes
                  )
                )
              : null;

          for (let i = 0; i < violations.length; i++) {
            const violation = violations[i];

            // 1. Validation
            if (
              !violation.sourceProject &&
              !violation.file &&
              !violation.workspaceViolation
            ) {
              throw new Error(
                `Invalid violation at index ${i} in rule "${ruleData.name}": ` +
                  `Violations with neither 'sourceProject' nor 'file' must have 'workspaceViolation: true'. ` +
                  `Violation message: "${violation.message}"`
              );
            }

            // 2. Automatic project inference
            if (!violation.sourceProject && violation.file) {
              const owningProject = fileToProject.get(violation.file);
              if (owningProject) {
                violation.sourceProject = owningProject;
              }
            }

            if (
              !hasAnyViolationFixGeneratorData &&
              'fixGeneratorData' in violation
            ) {
              hasAnyViolationFixGeneratorData = true;
            }

            // 3. Project filtering
            if (allowedProjectNames) {
              if (!violation.sourceProject) {
                processedViolations.push(violation);
                continue;
              }
              if (
                violation.sourceProject &&
                allowedProjectNames.has(violation.sourceProject)
              ) {
                processedViolations.push(violation);
              }
            } else {
              processedViolations.push(violation);
            }
          }
          ruleResult.details.violations = processedViolations;
        }

        const finalResult: ConformanceRuleResultWithRuleAndRunnerData = {
          ...ruleResult,
          ruleSpecifier,
          ruleData,
          resolvedStatus,
          runnerData: {
            status,
            scheduledStatus: scheduledStatus ?? null,
            scheduledStatusDate: scheduledStatusDate ?? null,
            fixGeneratorStatus,
            countOfOriginalViolations,
            countOfViolationsFixedByGenerator: 0,
            countOfViolationsFilteredByProjects:
              countOfOriginalViolations -
              (ruleResult.details.violations?.length ?? 0),
            // Execution time in whole milliseconds (peformance now has sub-ms precision)
            executionTimeMs: Math.round(endTime - startTime),
          },
        };

        return {
          finalResult,
          hasFixGenerator,
          fixGenerator,
          originalViolations: applyFixGenerators
            ? ruleResult.details.violations
            : undefined,
          ruleOptions,
          detailsFixGeneratorData: ruleResult.details.fixGeneratorData,
          hasAnyViolationFixGeneratorData,
          resolvedStatus,
        } as DiagnosticPhaseContext;
      }
    )
  );

  // Fix phase: apply fix generators (if requested)
  if (applyFixGenerators) {
    const writableTree = convertToWritable(tree);
    // Run fix generators sequentially to avoid race conditions
    for (const ctx of diagnosticResults) {
      if (
        ctx.resolvedStatus !== 'disabled' &&
        ctx.hasFixGenerator &&
        typeof ctx.fixGenerator === 'function'
      ) {
        const fixGeneratorSchemaData: Parameters<
          ConformanceRuleFixGenerator<Record<string, unknown>>
        >[1] = {
          violations: ctx.originalViolations ?? [],
          ruleOptions: ctx.ruleOptions ?? {},
        };
        if (ctx.detailsFixGeneratorData) {
          fixGeneratorSchemaData.fixGeneratorData = ctx.detailsFixGeneratorData;
        }
        await ctx.fixGenerator(writableTree, fixGeneratorSchemaData);
        ctx.finalResult.runnerData.fixGeneratorStatus = 'applied';
      }
    }
  }

  // Strip fixGeneratorData before returning results
  diagnosticResults.forEach((ctx) => {
    const { finalResult } = ctx;
    if ('fixGeneratorData' in finalResult.details) {
      delete finalResult.details.fixGeneratorData;
    }
    if (ctx.hasAnyViolationFixGeneratorData) {
      finalResult.details.violations.forEach((violation) => {
        if ('fixGeneratorData' in violation) {
          delete violation.fixGeneratorData;
        }
      });
    }
  });

  return {
    ruleResults: diagnosticResults.map((r) => r.finalResult),
  };
}

/**
 * If there is a scheduled status date, and it is right now or in the past, use the scheduled status.
 * Otherwise, use the current status.
 */
function resolveFinalRuleStatus(
  status: RuleStatus,
  {
    scheduledStatus,
    scheduledStatusDate,
  }: Pick<
    SuccessfulResolveRuleResultData,
    'status' | 'scheduledStatus' | 'scheduledStatusDate'
  >
) {
  if (scheduledStatusDate && scheduledStatus) {
    const now = new Date().getTime();
    const scheduled = new Date(scheduledStatusDate);
    if (scheduled.getTime() <= now) {
      return scheduledStatus;
    }
  }
  return status;
}
