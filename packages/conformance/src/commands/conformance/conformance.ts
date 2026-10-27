import {
  createProjectGraphAsync,
  type NxConformanceConfiguration,
  output,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { join } from 'node:path';
import {
  flushChanges,
  handleErrors,
  readFileMapCache,
  readNxJsonFromDisk,
} from '@nx/devkit/internal';
import * as pc from 'picocolors';
import {
  convertToWritable,
  ReadOnlyConformanceTree,
} from '../../conformance-tree';
import {
  resolveRule,
  type SuccessfulResolveRuleResultData,
} from '../../resolve-rule';
import { conformanceRulesRunner } from '../../rules-runner';
import { terminalReporter } from '../../terminal-reporter';
import type {
  ConformanceRuleResultWithRuleAndRunnerData,
  RuleStatus,
} from '../../types';

export interface ConformanceArgs {
  verbose?: boolean;
  printConfig?: boolean;
}

async function failingCloudRuleResolver(
  rule: string
): ReturnType<typeof resolveRule> {
  return {
    error: new Error(
      `Found Nx Cloud rule "${rule}" in the conformance config, but this workspace is not connected to Nx Cloud. Run \`nx connect\` to use Nx Cloud rules.`
    ),
    data: null,
  };
}

export async function conformanceHandler(
  args: ConformanceArgs,
  runFixGenerators: boolean | 'silent',
  cloudAdapter: {
    validateConfiguration: (
      conformanceConfig?: NxConformanceConfiguration
    ) => void;
    preRuleResolutionHook: (
      conformanceConfig: NxConformanceConfiguration
    ) => Promise<NxConformanceConfiguration>;
    ruleResolver: (rule: string) => ReturnType<typeof resolveRule>;
    postRuleResolutionHook: () => Promise<void>;
    postResultHook: (result: {
      ruleResults: ConformanceRuleResultWithRuleAndRunnerData[];
    }) => Promise<void>;
  } = {
    validateConfiguration,
    preRuleResolutionHook: async (c) => c,
    ruleResolver: failingCloudRuleResolver,
    postRuleResolutionHook: async () => undefined,
    postResultHook: async () => undefined,
  }
) {
  return handleErrors(!!args.verbose, async () => {
    const projectGraph = await createProjectGraphAsync();
    const fileMapCache = readFileMapCache();
    if (!fileMapCache) {
      throw new Error(
        'There was a critical error when reading the file map cache. If this does not resolve itself on the next run, please try running `nx reset` and then re-running the command.'
      );
    }

    const _conformanceConfig = readNxJsonFromDisk().conformance;

    // Validate the conformance configuration based on the context (e.g. cloud does not require explicit config, but local only does)
    cloudAdapter.validateConfiguration(_conformanceConfig);

    const conformanceConfigFromDisk =
      _conformanceConfig as NxConformanceConfiguration;

    // Apply Nx Cloud modifications to the nx.json configuration, if applicable, to create the final config
    const conformanceConfig = await cloudAdapter.preRuleResolutionHook(
      conformanceConfigFromDisk
    );

    // Resolve rules and handle any errors, if applicable
    const loadedRuleResults: Awaited<ReturnType<typeof resolveRule>>[] =
      await Promise.all(
        conformanceConfig.rules.map(
          async ({ rule, options, projects, status }) => {
            if (rule.startsWith('nx-cloud:')) {
              return cloudAdapter.ruleResolver(rule);
            }
            return resolveRule({
              rule,
              options,
              projects,
              status,
            });
          }
        )
      );

    const validatedLoadedRules: SuccessfulResolveRuleResultData[] = [];
    for (const res of loadedRuleResults) {
      if (res.error) {
        throw res.error;
      }
      validatedLoadedRules.push(res.data);
    }

    // Print the final config, if requested, once the configuration has been validated and rules have been resolved
    if (args.printConfig) {
      output.success({
        title: 'Final conformance configuration',
        bodyLines: [JSON.stringify(conformanceConfig, null, 2)],
      });
      return 0;
    }

    await cloudAdapter.postRuleResolutionHook();

    const conformanceTree = new ReadOnlyConformanceTree(
      workspaceRoot,
      !!args.verbose
    );

    const result = await conformanceRulesRunner({
      tree: conformanceTree,
      projectGraph,
      fileMapCache,
      loadedRules: validatedLoadedRules,
      applyFixGenerators: !!runFixGenerators, // Apply fixes for both true and 'silent'
    });

    // Set the tree to writable so that the FsTree listChanges method can be called
    const treeChanges = convertToWritable(conformanceTree).listChanges();

    if (runFixGenerators) {
      // Flush any changes made by fix generators to disk
      flushChanges(workspaceRoot, treeChanges);

      // Only re-run and update results if not in silent mode
      if (runFixGenerators !== 'silent') {
        // Re-run rules again given that one or more fix generators may have been applied
        const resultAfterFixes = await conformanceRulesRunner({
          tree: conformanceTree,
          projectGraph,
          fileMapCache,
          loadedRules: validatedLoadedRules,
          applyFixGenerators: false,
        });

        for (const ruleResult of resultAfterFixes.ruleResults) {
          for (let i = 0; i < result.ruleResults.length; i++) {
            if (
              result.ruleResults[i].ruleData.name === ruleResult.ruleData.name
            ) {
              result.ruleResults[i] = {
                ...ruleResult,
                runnerData: {
                  ...result.ruleResults[i].runnerData,
                  countOfViolationsFixedByGenerator:
                    result.ruleResults[i].runnerData.countOfOriginalViolations -
                    result.ruleResults[i].runnerData
                      .countOfViolationsFilteredByProjects -
                    ruleResult.details.violations.length,
                },
              };
              break;
            }
          }
        }
      }
    }

    let exitCode = 0;
    // `null` represents no violations of any kind
    let overallSeverity: 'high' | 'medium' | 'low' | null = null;
    console.log('');

    result.ruleResults.forEach((ruleResult) => {
      // Track overall severity
      if (
        Object.keys(ruleResult.details).length === 0 ||
        (Array.isArray(ruleResult.details?.violations) &&
          ruleResult.details.violations.length === 0)
      ) {
        return;
      }

      // If any rule has more than one violation that is enforced (i.e. not disabled or evaluated), the overall conformance runner should exit with code 1
      if (ruleResult.resolvedStatus === 'enforced') {
        exitCode = 1;
      }

      if (ruleResult.severity === 'high') {
        overallSeverity = 'high';
      } else if (
        ruleResult.severity === 'medium' &&
        overallSeverity !== 'high'
      ) {
        overallSeverity = 'medium';
      } else if (
        ruleResult.severity === 'low' &&
        overallSeverity !== 'high' &&
        overallSeverity !== 'medium'
      ) {
        overallSeverity = 'low';
      }
    });

    // Print the final result using the terminal reporter
    terminalReporter(result);

    // Write the final conformance result to disk, unless explicitly disabled by the user
    const outputFileLogs: string[] = [];
    if (conformanceConfig.outputPath !== false) {
      const DEFAULT_CONFORMANCE_RESULT_PATH = join(
        'dist',
        'conformance-result.json'
      );
      const workspaceRelativeConformanceResultPath =
        conformanceConfig.outputPath || DEFAULT_CONFORMANCE_RESULT_PATH;
      const conformanceResultPath = join(
        workspaceRoot,
        workspaceRelativeConformanceResultPath
      );
      writeJsonFile(conformanceResultPath, result);
      outputFileLogs.push(
        '',
        pc.dim(
          `Results data written to ${workspaceRelativeConformanceResultPath}`
        )
      );
    }

    await cloudAdapter.postResultHook(result);

    let fixGeneratorsSummaryText = '';
    // Only show fix generator summary if not in silent mode
    if (
      runFixGenerators &&
      runFixGenerators !== 'silent' &&
      treeChanges.length > 0
    ) {
      fixGeneratorsSummaryText = `🔧 Fix generators were applied to ${treeChanges.length} file(s)\n`;
    }

    if (!overallSeverity) {
      let ruleText = 'rules';
      if (validatedLoadedRules.length === 1) {
        ruleText = 'rule';
      }
      console.log('');
      output.addVerticalSeparatorWithoutNewLines('green');
      output.success({
        title: 'Conformance checks passed successfully',
        bodyLines: [
          `No violations found across ${validatedLoadedRules.length} ${ruleText}.\n`,
          fixGeneratorsSummaryText,
          ...outputFileLogs,
        ].filter(Boolean),
      });
      return 0;
    }

    let outputFn = output.log.bind(output);
    let color = 'cyan';
    switch (overallSeverity) {
      case 'high':
        color = 'red';
        outputFn = output.error.bind(output);
        break;
      case 'medium':
        color = 'yellow';
        outputFn = output.warn.bind(output);
        break;
    }

    console.log('');
    output.addVerticalSeparatorWithoutNewLines(color);

    outputFn({
      title: `Conformance checks require attention, ${overallSeverity} severity`,
      bodyLines: [
        `One or more conformance checks have provided feedback which requires attention.\n`,
        fixGeneratorsSummaryText,
        ...outputFileLogs,
      ].filter(Boolean),
    });

    return exitCode;
  });
}

function validateConfiguration(conformanceConfig?: NxConformanceConfiguration) {
  if (!conformanceConfig) {
    throw new Error('No "conformance" configuration found in nx.json');
  }
  if (!conformanceConfig.rules || !Array.isArray(conformanceConfig.rules)) {
    throw new Error(
      'The "conformance.rules" configuration in nx.json must be an array'
    );
  }
  if (conformanceConfig.rules.length === 0) {
    throw new Error(
      'The "conformance.rules" configuration in nx.json must contain at least one rule'
    );
  }
  for (const rule of conformanceConfig.rules) {
    if (
      rule.projects &&
      (!Array.isArray(rule.projects) ||
        rule.projects.length === 0 ||
        !rule.projects.every((project) => {
          if (typeof project === 'string') {
            return true;
          }
          // Object style
          if (
            typeof project.matcher === 'string' &&
            project.matcher.length > 0 &&
            typeof project.explanation === 'string' &&
            project.explanation.length > 0
          ) {
            return true;
          }
          return false;
        }))
    ) {
      throw new Error(
        'When set, the "rule.projects" configuration must be an array of either strings or objects with a "matcher" string and "explanation" string, with at least one valid entry specified'
      );
    }

    const validStatuses: RuleStatus[] = ['enforced', 'evaluated', 'disabled'];
    if (rule.status && !validStatuses.includes(rule.status)) {
      throw new Error(
        `The "rule.status" configuration in nx.json must be one of the following: ${validStatuses.join(
          ', '
        )}`
      );
    }
  }
}
