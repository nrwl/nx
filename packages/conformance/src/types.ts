import type {
  Generator,
  NxConformanceConfiguration,
  ProjectGraph,
} from '@nx/devkit';
import type { FileMapCache } from '@nx/devkit/internal';
import type {
  ReadOnlyConformanceTree,
  WritableConformanceTree,
} from './conformance-tree';

/**
 * Arbitrary data provided by a rule implementation (via details.fixGeneratorData or fixGeneratorData on a violation directly)
 * that is passed to the rule's fix generator. If set, the fixGeneratorData on a violation will only be used by the fix generator
 * and be stripped before the report is generated.
 */
export type FixGeneratorData = Record<string, unknown>;

export type ConformanceViolation = {
  message: string;
  /**
   * Optional file path. If provided without sourceProject, the rules runner will attempt to infer
   * the owning project from the Nx project file map.
   */
  file?: string;
  /**
   * Optional source project. If provided, violations will be grouped by project in the output.
   */
  sourceProject?: string;
  /**
   * Set to true to mark this as a workspace-level violation. This is required when neither
   * file nor sourceProject is provided. Workspace violations represent issues that affect
   * the entire workspace rather than specific projects or files.
   */
  workspaceViolation?: boolean;
  /**
   * If set, the fixGeneratorData on a violation will only be used by the fix generator
   * and be stripped before the report is generated.
   */
  fixGeneratorData?: FixGeneratorData;
};

/**
 * @deprecated Import `NxConformanceConfiguration` from `@nx/devkit` instead. This will be removed in Nx 25.
 */
export type NxJsonConformanceConfiguration = NxConformanceConfiguration;

type NxConformanceRuleConfiguration =
  NxConformanceConfiguration['rules'][number];

export type RuleStatus = NonNullable<NxConformanceRuleConfiguration['status']>;

export type RuleProjectsConfig = NonNullable<
  NxConformanceRuleConfiguration['projects']
>;

export type ConformanceRuleResult = {
  severity: ConformanceRuleResultSeverity;
  details: {
    violations: ConformanceViolation[];
    /**
     * If set, the fixGeneratorData will only be used by the fix generator
     * and be stripped before the report is generated.
     */
    fixGeneratorData?: FixGeneratorData;
  };
};

export interface ConformanceRuleContext<RuleOptions = undefined> {
  tree: ReadOnlyConformanceTree;
  projectGraph: ProjectGraph;
  fileMapCache: FileMapCache;
  ruleOptions: RuleOptions;
}

/**
 * NOTE: In the case where the rule status is "disabled", the severity will be set imperatively by the rule
 * runner to `null`, but it is not a valid severity for a rule to return, so it is not included in the type.
 */
export type ConformanceRuleResultSeverity = 'high' | 'medium' | 'low';
export type ConformanceRuleCategory =
  | 'consistency'
  | 'maintainability'
  | 'reliability'
  | 'security';

// The tree from @nx/devkit is typed as `any`, which is not useful for rule authors, so we apply the appropriate type on top
type GeneratorWithTypedTree<T = unknown> = (
  tree: WritableConformanceTree,
  schema: T
) => ReturnType<Generator<T>>;

export type ConformanceRuleFixGenerator<RuleOptions> = GeneratorWithTypedTree<{
  violations: ConformanceViolation[];
  ruleOptions: RuleOptions;
  fixGeneratorData?: FixGeneratorData;
}>;

export type ConformanceRule<RuleOptions = undefined> = {
  name: string;
  category: ConformanceRuleCategory;
  description: string;
  implementation: (
    context: ConformanceRuleContext<RuleOptions>
  ) => Promise<ConformanceRuleResult>;
  /**
   * Optional nx generator implementation intended to fix the the violations reported by the rule.
   */
  fixGenerator?: ConformanceRuleFixGenerator<RuleOptions>;
};

export type ConformanceRuleResultWithRuleAndRunnerData =
  ConformanceRuleResult & {
    ruleSpecifier: string;
    ruleData: Omit<ConformanceRule<any>, 'implementation' | 'fixGenerator'>;
    resolvedStatus: RuleStatus;
    runnerData: {
      status: RuleStatus;
      /**
       * Only applicable to Nx Cloud Enterprise users.
       */
      scheduledStatus: RuleStatus | null;
      /**
       * Only applicable to Nx Cloud Enterprise users.
       * Unix timestamp in milliseconds.
       */
      scheduledStatusDate: number | null;
      fixGeneratorStatus: 'no-fix-generator' | 'applied' | 'not-applied';
      countOfOriginalViolations: number;
      countOfViolationsFixedByGenerator: number;
      countOfViolationsFilteredByProjects: number;
      executionTimeMs: number;
    };
  };

export type ConformanceReporter = (data: {
  ruleResults: ConformanceRuleResultWithRuleAndRunnerData[];
}) => void;
