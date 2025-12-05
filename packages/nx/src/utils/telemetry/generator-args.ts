/**
 * Generator argument allowlists for telemetry sanitization.
 *
 * This module defines which arguments are safe to collect for each known generator.
 * Arguments are categorized as:
 * - safeArgs: Can be collected with their values
 * - presenceOnlyArgs: Only the presence is recorded (value redacted)
 * - categorizedArgs: Value must match one of the allowed values
 */

import { KNOWN_NX_GENERATORS } from './constants';

/**
 * Specification for how to handle generator arguments.
 */
export interface GeneratorArgSpec {
  /**
   * Arguments that are safe to record with their full values.
   */
  safeArgs: Set<string>;

  /**
   * Arguments where only presence is recorded, not the value.
   */
  presenceOnlyArgs: Set<string>;

  /**
   * Arguments that have a known set of valid values.
   * Only values in the set are recorded; others are redacted.
   */
  categorizedArgs: Map<string, Set<string>>;
}

/**
 * Common safe arguments shared across most generators.
 */
const COMMON_SAFE_ARGS = new Set([
  // Boolean flags
  'dry-run',
  'dryRun',
  'skip-format',
  'skipFormat',
  'verbose',
  'interactive',
  'defaults',

  // Standard options with limited values
  'style',
  'linter',
  'bundler',
  'unitTestRunner',
  'unit-test-runner',
  'e2eTestRunner',
  'e2e-test-runner',

  // Structure options
  'flat',
  'standalone',
  'routing',
  'strict',
  'publishable',
  'buildable',
  'inlineStyle',
  'inline-style',
  'inlineTemplate',
  'inline-template',
  'skipTests',
  'skip-tests',
  'skipPackageJson',
  'skip-package-json',
  'export',
  'js',
  'pascalCaseFiles',
  'pascal-case-files',
  'pascalCaseDirectory',
  'pascal-case-directory',
  'globalCss',
  'global-css',
]);

/**
 * Arguments that should only record presence, not value.
 * These typically contain potentially identifying information.
 */
const COMMON_PRESENCE_ONLY_ARGS = new Set([
  // Names - could identify the project/component
  'name',
  'project',
  'projectName',
  'project-name',
  'directory',
  'path',

  // Import paths - could reveal internal structure
  'importPath',
  'import-path',

  // Selectors and prefixes - could be identifying
  'selector',
  'prefix',

  // Tags - could reveal project organization
  'tags',

  // Custom values
  'className',
  'class-name',
  'fileName',
  'file-name',
]);

/**
 * Style options available across generators.
 */
const STYLE_OPTIONS = new Set([
  'css',
  'scss',
  'sass',
  'less',
  'styl',
  'stylus',
  'styled-components',
  'styled-jsx',
  '@emotion/styled',
  'emotion',
  'none',
]);

/**
 * Linter options.
 */
const LINTER_OPTIONS = new Set(['eslint', 'none']);

/**
 * Bundler options.
 */
const BUNDLER_OPTIONS = new Set([
  'webpack',
  'vite',
  'esbuild',
  'rollup',
  'swc',
  'tsc',
  'none',
]);

/**
 * Unit test runner options.
 */
const UNIT_TEST_RUNNER_OPTIONS = new Set(['jest', 'vitest', 'none']);

/**
 * E2E test runner options.
 */
const E2E_TEST_RUNNER_OPTIONS = new Set(['cypress', 'playwright', 'none']);

/**
 * Angular change detection strategies.
 */
const CHANGE_DETECTION_OPTIONS = new Set(['Default', 'OnPush']);

/**
 * Angular view encapsulation options.
 */
const VIEW_ENCAPSULATION_OPTIONS = new Set([
  'Emulated',
  'None',
  'ShadowDom',
]);

/**
 * Common categorized args with their allowed values.
 */
const COMMON_CATEGORIZED_ARGS = new Map<string, Set<string>>([
  ['style', STYLE_OPTIONS],
  ['linter', LINTER_OPTIONS],
  ['bundler', BUNDLER_OPTIONS],
  ['unitTestRunner', UNIT_TEST_RUNNER_OPTIONS],
  ['unit-test-runner', UNIT_TEST_RUNNER_OPTIONS],
  ['e2eTestRunner', E2E_TEST_RUNNER_OPTIONS],
  ['e2e-test-runner', E2E_TEST_RUNNER_OPTIONS],
]);

/**
 * Default spec for unknown @nx/* generators.
 */
const DEFAULT_NX_GENERATOR_SPEC: GeneratorArgSpec = {
  safeArgs: COMMON_SAFE_ARGS,
  presenceOnlyArgs: COMMON_PRESENCE_ONLY_ARGS,
  categorizedArgs: COMMON_CATEGORIZED_ARGS,
};

/**
 * Generator-specific specs that extend or override the defaults.
 */
const GENERATOR_SPECS: Record<string, Partial<GeneratorArgSpec>> = {
  // React generators
  '@nx/react:component': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'classComponent',
      'class-component',
    ]),
  },
  '@nx/react:library': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'component',
      'compiler',
    ]),
    categorizedArgs: new Map([
      ...COMMON_CATEGORIZED_ARGS,
      ['compiler', new Set(['babel', 'swc'])],
    ]),
  },
  '@nx/react:application': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'compiler',
    ]),
    categorizedArgs: new Map([
      ...COMMON_CATEGORIZED_ARGS,
      ['compiler', new Set(['babel', 'swc'])],
    ]),
  },

  // Angular generators
  '@nx/angular:component': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'displayBlock',
      'display-block',
      'skipSelector',
      'skip-selector',
    ]),
    categorizedArgs: new Map([
      ...COMMON_CATEGORIZED_ARGS,
      ['changeDetection', CHANGE_DETECTION_OPTIONS],
      ['change-detection', CHANGE_DETECTION_OPTIONS],
      ['viewEncapsulation', VIEW_ENCAPSULATION_OPTIONS],
      ['view-encapsulation', VIEW_ENCAPSULATION_OPTIONS],
    ]),
  },
  '@nx/angular:library': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'addModuleSpec',
      'add-module-spec',
      'lazy',
    ]),
  },
  '@nx/angular:application': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'ssr',
      'backendProject',
      'backend-project',
    ]),
  },

  // Node generators
  '@nx/node:application': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'framework',
    ]),
    categorizedArgs: new Map([
      ...COMMON_CATEGORIZED_ARGS,
      ['framework', new Set(['express', 'fastify', 'koa', 'nest', 'none'])],
    ]),
  },

  // Next.js generators
  '@nx/next:application': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'appDir',
      'app-dir',
      'src',
    ]),
  },

  // Plugin generators
  '@nx/plugin:generator': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'skipLintChecks',
      'skip-lint-checks',
    ]),
  },
  '@nx/plugin:executor': {
    safeArgs: new Set([
      ...COMMON_SAFE_ARGS,
      'includeHasher',
      'include-hasher',
    ]),
  },
};

/**
 * Build complete spec by merging defaults with generator-specific overrides.
 */
function buildSpec(generatorName: string): GeneratorArgSpec {
  const specific = GENERATOR_SPECS[generatorName];

  if (!specific) {
    return DEFAULT_NX_GENERATOR_SPEC;
  }

  return {
    safeArgs: specific.safeArgs ?? DEFAULT_NX_GENERATOR_SPEC.safeArgs,
    presenceOnlyArgs:
      specific.presenceOnlyArgs ?? DEFAULT_NX_GENERATOR_SPEC.presenceOnlyArgs,
    categorizedArgs:
      specific.categorizedArgs ?? DEFAULT_NX_GENERATOR_SPEC.categorizedArgs,
  };
}

/**
 * Get the argument specification for a generator.
 *
 * @param generatorName The full generator name (e.g., '@nx/react:component')
 * @returns The argument spec, or undefined for non-Nx generators
 */
export function getGeneratorArgSpec(
  generatorName: string
): GeneratorArgSpec | undefined {
  if (!generatorName) {
    return undefined;
  }

  // Only provide specs for known Nx generators
  const isKnownNx =
    generatorName.startsWith('@nx/') || generatorName.startsWith('@nrwl/');

  if (!isKnownNx) {
    // For non-Nx generators, return undefined to indicate all args should be redacted
    return undefined;
  }

  // Normalize @nrwl to @nx
  const normalizedName = generatorName.replace('@nrwl/', '@nx/');

  // Return specific spec if available, otherwise default
  if (KNOWN_NX_GENERATORS.has(normalizedName)) {
    return buildSpec(normalizedName);
  }

  // For unknown @nx/* generators, use the default spec
  return DEFAULT_NX_GENERATOR_SPEC;
}
