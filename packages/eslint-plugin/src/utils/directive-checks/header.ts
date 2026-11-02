import {
  dependsOnProjects,
  findClosestMatches,
  matchNxDirective,
  NX_DIRECTIVE_NAMES,
  readNxDirectiveHeader,
  type NxDirectiveHeaderLine,
} from '@nx/devkit/internal';
import type { TSESTree } from '@typescript-eslint/utils';

type NxDirectiveName = (typeof NX_DIRECTIVE_NAMES)[number];

const DIRECTIVE_FORMS = {
  'depends-on': '@nx-depends-on: <project>, <project>',
  'ignore-server-inputs': '@nx-ignore-server-inputs',
  'target-name': '@nx-target-name: <name>',
} satisfies Record<NxDirectiveName, string>;

// A known name not followed by a name character, e.g. `@nx-depends-on shop`.
const KNOWN_DIRECTIVE_START = new RegExp(
  `^@nx-(${NX_DIRECTIVE_NAMES.join('|')})(?![\\w-])`
);

export type HeaderMessageId =
  | 'unknownDirective'
  | 'unknownDirectiveSuggestion'
  | 'unparsableDirective'
  | 'directiveAfterCode'
  | 'emptyDependsOn'
  | 'ignoreServerInputsValue'
  | 'emptyTargetName'
  | 'extraTargetName';

export interface Span {
  start: number;
  end: number;
}

export interface HeaderProblem extends Span {
  messageId: HeaderMessageId;
  data?: Record<string, string>;
}

export interface DirectiveHeader {
  problems: HeaderProblem[];
  /** The `@nx-depends-on` lines and each project pattern they list. */
  dependsOn: { lines: Span[]; patterns: (Span & { pattern: string })[] };
  /** The `@nx-ignore-server-inputs` lines. */
  ignoreServerInputs: { lines: Span[] };
}

/**
 * The directives in the comment block that opens `content`, and the mistakes
 * that make Nx ignore one: an unknown name, a line Nx can't read, a value Nx
 * ignores, and a known directive in a comment after code.
 */
export function checkDirectiveHeader(
  content: string,
  comments: TSESTree.Comment[]
): DirectiveHeader {
  const header = readNxDirectiveHeader(content);
  const problems: HeaderProblem[] = [];
  const dependsOn: DirectiveHeader['dependsOn'] = { lines: [], patterns: [] };
  const ignoreServerInputs: DirectiveHeader['ignoreServerInputs'] = {
    lines: [],
  };
  const targetNames: (Span & { value: string })[] = [];

  for (const line of header.lines) {
    const span = lineSpan(line);
    const directive = matchNxDirective(line.text);
    if (!directive) {
      const name = line.text.match(KNOWN_DIRECTIVE_START)?.[1];
      if (name) {
        problems.push({
          ...span,
          messageId: 'unparsableDirective',
          data: { name, form: DIRECTIVE_FORMS[name as NxDirectiveName] },
        });
      }
      continue;
    }
    const name = directive.name;
    if (!isNxDirectiveName(name)) {
      const [suggestion] = findClosestMatches(name, NX_DIRECTIVE_NAMES, 1);
      problems.push(
        suggestion
          ? {
              ...span,
              messageId: 'unknownDirectiveSuggestion',
              data: { name, suggestion },
            }
          : { ...span, messageId: 'unknownDirective', data: { name } }
      );
      continue;
    }
    switch (name) {
      case 'depends-on':
        dependsOn.lines.push(span);
        dependsOn.patterns.push(...projectPatterns(line));
        break;
      case 'ignore-server-inputs':
        ignoreServerInputs.lines.push(span);
        if (directive.value !== '') {
          problems.push({ ...span, messageId: 'ignoreServerInputsValue' });
        }
        break;
      case 'target-name':
        targetNames.push({ ...span, value: directive.value });
        break;
      default: {
        const unhandled: never = name;
        throw new Error(`Unhandled directive "@nx-${unhandled}"`);
      }
    }
  }

  // Nx merges every `@nx-depends-on` line, so one empty line is harmless.
  if (dependsOn.lines.length > 0 && dependsOn.patterns.length === 0) {
    for (const span of dependsOn.lines) {
      problems.push({ ...span, messageId: 'emptyDependsOn' });
    }
  }
  // Nx reads the first `@nx-target-name` only.
  const [targetName, ...extraTargetNames] = targetNames;
  if (targetName?.value === '') {
    problems.push({ ...targetName, messageId: 'emptyTargetName' });
  }
  for (const extra of extraTargetNames) {
    problems.push({ ...extra, messageId: 'extraTargetName' });
  }

  // A block comment can start in the header and end on a line with code, so
  // compare each line, not the comment, with the header's end.
  for (const comment of comments) {
    for (const line of commentLines(comment)) {
      if (line.start < header.end) {
        continue;
      }
      const name = line.text.match(KNOWN_DIRECTIVE_START)?.[1];
      if (name) {
        problems.push({
          ...lineSpan(line),
          messageId: 'directiveAfterCode',
          data: { name },
        });
      }
    }
  }

  return { problems, dependsOn, ignoreServerInputs };
}

function isNxDirectiveName(name: string): name is NxDirectiveName {
  return (NX_DIRECTIVE_NAMES as readonly string[]).includes(name);
}

function lineSpan(line: NxDirectiveHeaderLine): Span {
  return { start: line.start, end: line.start + line.text.length };
}

/** The patterns `dependsOnProjects` reads from the line, where each is. */
function projectPatterns(
  line: NxDirectiveHeaderLine
): (Span & { pattern: string })[] {
  const patterns: (Span & { pattern: string })[] = [];
  const valueStart = line.text.indexOf(':') + 1;
  if (valueStart === 0) {
    return patterns;
  }
  let offset = line.start + valueStart;
  for (const part of line.text.slice(valueStart).split(',')) {
    const [pattern] = dependsOnProjects([part]);
    if (pattern) {
      const start = offset + part.indexOf(pattern);
      patterns.push({ pattern, start, end: start + pattern.length });
    }
    offset += part.length + 1;
  }
  return patterns;
}

/** Each line of a comment without its markers, trimmed, and where it starts. */
function commentLines(comment: TSESTree.Comment): NxDirectiveHeaderLine[] {
  const lines: NxDirectiveHeaderLine[] = [];
  let offset = comment.range[0] + 2;
  for (const raw of comment.value.split('\n')) {
    const marker =
      comment.type === 'Block' ? (raw.match(/^\s*\*+/)?.[0].length ?? 0) : 0;
    const rest = raw.slice(marker);
    const text = rest.trim();
    lines.push({
      text,
      start: offset + marker + rest.length - rest.trimStart().length,
    });
    offset += raw.length + 1;
  }
  return lines;
}
