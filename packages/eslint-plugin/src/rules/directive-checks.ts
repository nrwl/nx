import { normalizePath, workspaceRoot } from '@nx/devkit';
import type { TestFileDirective } from '@nx/devkit/internal';
import { ESLintUtils } from '@typescript-eslint/utils';
import {
  checkDirectiveHeader,
  type DirectiveHeader,
  type HeaderMessageId,
  type Span,
} from '../utils/directive-checks/header';
import { findUnmatchedProjectPatterns } from '../utils/directive-checks/project-patterns';
import {
  findSplitTargets,
  splitTargetsApply,
  splitTargetsKeepDependsOnInputs,
} from '../utils/directive-checks/split-targets';
import { readProjectGraph } from '../utils/project-graph-utils';
import { findProject, getSourceFilePath } from '../utils/runtime-lint-utils';

export type Options = [];

export type MessageIds =
  | HeaderMessageId
  | 'unsupportedDirective'
  | 'unmatchedProject'
  | 'unmatchedProjectSuggestion';

export const RULE_NAME = 'directive-checks';

const VALUE_PROBLEM_DIRECTIVES: Partial<
  Record<HeaderMessageId, TestFileDirective>
> = {
  emptyDependsOn: 'depends-on',
  ignoreServerInputsValue: 'ignore-server-inputs',
};

export default ESLintUtils.RuleCreator(
  () => `https://nx.dev/docs/kb/directive-checks`
)<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Checks the `@nx-` directives in the comment block that opens a file.',
    },
    schema: [],
    messages: {
      unknownDirective:
        '"@nx-{{name}}" is not a directive Nx reads, so Nx ignores it.',
      unknownDirectiveSuggestion:
        '"@nx-{{name}}" is not a directive Nx reads, so Nx ignores it. Did you mean "@nx-{{suggestion}}"?',
      unparsableDirective:
        'Nx can\'t read this "@nx-{{name}}" directive, so it ignores it. Write it as "{{form}}".',
      directiveAfterCode:
        'Nx reads "@nx-{{name}}" only in the comments that open the file, on lines before any code, so it ignores this one.',
      emptyDependsOn:
        '"@nx-depends-on" lists no projects, so Nx ignores it. List the projects the test depends on, separated by commas.',
      ignoreServerInputsValue:
        '"@nx-ignore-server-inputs" takes no value, so Nx ignores it. Write "@nx-ignore-server-inputs" alone.',
      emptyTargetName: '"@nx-target-name" is empty, so Nx ignores it.',
      extraTargetName:
        'Nx reads only the first "@nx-target-name", so it ignores this one.',
      unsupportedDirective:
        'No split task that runs this file applies "@nx-{{name}}", so Nx ignores it.',
      unmatchedProject:
        '"{{pattern}}" matches no project. Any Nx command that runs this test fails.',
      unmatchedProjectSuggestion:
        '"{{pattern}}" matches no project. Any Nx command that runs this test fails. Did you mean "{{suggestion}}"?',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    if (!sourceCode.text.includes('@nx-')) {
      return {};
    }

    function report(
      span: Span,
      messageId: MessageIds,
      data?: Record<string, string>
    ) {
      context.report({
        loc: {
          start: sourceCode.getLocFromIndex(span.start),
          end: sourceCode.getLocFromIndex(span.end),
        },
        messageId,
        data,
      });
    }

    function reportUnsupported(lines: Span[], name: TestFileDirective) {
      for (const line of lines) {
        report(line, 'unsupportedDirective', { name });
      }
    }

    /**
     * Runs the checks of atomized test files and returns the directives their
     * runner ignores.
     */
    function checkSplitTargets({
      dependsOn,
      ignoreServerInputs,
    }: DirectiveHeader): Set<TestFileDirective> {
      const ignoredByRunner = new Set<TestFileDirective>();
      if (
        dependsOn.lines.length === 0 &&
        ignoreServerInputs.lines.length === 0
      ) {
        return ignoredByRunner;
      }

      const graph = readProjectGraph(RULE_NAME);
      if (!graph.projectGraph) {
        return ignoredByRunner;
      }
      const projectPath = normalizePath(
        (global as any).projectPath || workspaceRoot
      );
      const sourceFilePath = getSourceFilePath(
        normalizePath(context.filename ?? context.getFilename()),
        projectPath
      );
      const sourceProject = findProject(
        graph.projectGraph,
        graph.projectRootMappings,
        sourceFilePath
      );
      if (!sourceProject) {
        return ignoredByRunner;
      }
      const targets = findSplitTargets(sourceProject, sourceFilePath);
      if (targets.length === 0) {
        return ignoredByRunner;
      }

      if (dependsOn.lines.length > 0) {
        if (!splitTargetsApply(targets, 'depends-on')) {
          reportUnsupported(dependsOn.lines, 'depends-on');
          ignoredByRunner.add('depends-on');
        } else if (
          splitTargetsKeepDependsOnInputs(
            graph.projectGraph,
            sourceProject,
            targets
          )
        ) {
          // The cached graph can predate the latest edit, so check the patterns
          // in the file, not the ones the cached inputs list.
          const unmatched = findUnmatchedProjectPatterns(
            dependsOn.patterns
              .map(({ pattern }) => pattern)
              .filter((pattern) => !pattern.startsWith('!')),
            graph.projectGraph
          );
          for (const { pattern, ...span } of dependsOn.patterns) {
            if (!unmatched.has(pattern)) {
              continue;
            }
            const suggestion = unmatched.get(pattern);
            if (suggestion) {
              report(span, 'unmatchedProjectSuggestion', {
                pattern,
                suggestion,
              });
            } else {
              report(span, 'unmatchedProject', { pattern });
            }
          }
        }
      }

      if (
        ignoreServerInputs.lines.length > 0 &&
        !splitTargetsApply(targets, 'ignore-server-inputs')
      ) {
        reportUnsupported(ignoreServerInputs.lines, 'ignore-server-inputs');
        ignoredByRunner.add('ignore-server-inputs');
      }
      return ignoredByRunner;
    }

    return {
      Program() {
        const header = checkDirectiveHeader(
          sourceCode.text,
          sourceCode.getAllComments()
        );
        const ignoredByRunner = checkSplitTargets(header);
        for (const { messageId, data, ...span } of header.problems) {
          // Nx reports only that the runner ignores the directive.
          if (!ignoredByRunner.has(VALUE_PROBLEM_DIRECTIVES[messageId])) {
            report(span, messageId, data);
          }
        }
      },
    };
  },
});
