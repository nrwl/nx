import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';

/**
 * Patterns that disable tests in common JS/TS test frameworks.
 * Think of these like "TODO" comments — they signal intent to skip,
 * which can easily become permanent if no one enforces it.
 */
const DISABLED_TEST_PATTERNS = [
  // Jest / Vitest / Mocha
  { regex: /\b(it|test|describe)\.skip\s*\(/, label: '.skip()' },
  // Jasmine-style
  { regex: /\b(xit|xdescribe|xtest)\s*\(/, label: 'x-prefixed test' },
  // Jest .todo
  { regex: /\b(it|test)\.todo\s*\(/, label: '.todo()' },
];

const TEST_FILE_EXTENSIONS = /\.(spec|test)\.(ts|tsx|js|jsx|mjs|cjs)$/;

/**
 * Extract the test description string from a line like:
 *   it.skip('should do something', () => {
 *   xit("another test", () => {
 */
function extractTestDescription(line: string): string | null {
  // Match the first string argument (single quotes, double quotes, or backticks)
  const match = line.match(/\(\s*(['"`])((?:(?!\1).)*)\1/);
  return match ? match[2] : null;
}

/**
 * Look at the lines immediately above for TODO/FIXME/HACK comments
 * that explain why the test is disabled.
 */
function findNearbyTodoComment(
  lines: string[],
  lineIndex: number
): string | null {
  const todoPattern = /\/[/*]\s*(TODO|FIXME|HACK|NOTE|XXX)\b[:\s]*(.*)/i;
  // Check up to 3 lines above the disabled test
  const start = Math.max(0, lineIndex - 3);
  for (let i = lineIndex - 1; i >= start; i--) {
    const match = lines[i].match(todoPattern);
    if (match) {
      return `${match[1].toUpperCase()}: ${match[2].trim()}`;
    }
  }
  return null;
}

export default createConformanceRule({
  name: 'no-disabled-tests',
  category: 'maintainability',
  description:
    'Ensures that tests are not disabled via .skip(), .todo(), or x-prefixed functions (xit, xdescribe, xtest)',
  implementation: async ({ tree, fileMapCache }) => {
    const violations: ConformanceViolation[] = [];

    const projectFileMap = fileMapCache.fileMap.projectFileMap ?? {};

    for (const [projectName, files] of Object.entries(projectFileMap)) {
      for (const { file } of files) {
        if (!TEST_FILE_EXTENSIONS.test(file)) {
          continue;
        }

        const content = tree.read(file, 'utf-8');
        if (!content) {
          continue;
        }

        const fileViolations = findDisabledTests(content, file, projectName);
        violations.push(...fileViolations);
      }
    }

    return {
      severity: 'medium',
      details: {
        violations,
      },
    };
  },
});

export function findDisabledTests(
  content: string,
  filePath: string,
  sourceProject: string
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { regex, label } of DISABLED_TEST_PATTERNS) {
      if (regex.test(line)) {
        const description = extractTestDescription(line);
        const todo = findNearbyTodoComment(lines, i);

        let message = `Disabled test at line ${i + 1}`;
        if (description) {
          message += `: "${description}"`;
        }
        message += ` (${label})`;
        if (todo) {
          message += ` — ${todo}`;
        }

        violations.push({
          message,
          file: filePath,
          sourceProject,
        });
      }
    }
  }

  return violations;
}
