/**
 * Sanitization utilities for telemetry data.
 *
 * These functions ensure no sensitive information (paths, project names,
 * secrets, etc.) is included in telemetry data.
 */

import type { SanitizedArgs, SanitizedValue } from './types';
import {
  STANDARD_TARGETS,
  STANDARD_CONFIGS,
  KNOWN_COMMANDS,
  SENSITIVE_FLAGS,
  SAFE_FLAGS,
  KNOWN_PLUGIN_PREFIXES,
} from './constants';
import { getGeneratorArgSpec } from './generator-args';

/**
 * Redacted value placeholder.
 */
const REDACTED = '[REDACTED]' as const;

/**
 * Custom target/config placeholder.
 */
const CUSTOM = '[custom]' as const;

/**
 * Project name anonymization map.
 * Maps real project names to anonymized placeholders.
 */
const projectNameMap = new Map<string, string>();
let projectCounter = 0;

/**
 * Reset the project name map.
 * Useful for testing.
 */
export function resetProjectNameMap(): void {
  projectNameMap.clear();
  projectCounter = 0;
}

/**
 * Anonymize a project name to a placeholder like 'project-1'.
 * The same project name will always map to the same placeholder within a session.
 */
export function anonymizeProjectName(name: string): string {
  if (!name) {
    return name;
  }

  let placeholder = projectNameMap.get(name);
  if (!placeholder) {
    projectCounter++;
    placeholder = `project-${projectCounter}`;
    projectNameMap.set(name, placeholder);
  }
  return placeholder;
}

/**
 * Check if a string looks like a file path.
 */
function looksLikePath(value: string): boolean {
  // Absolute paths
  if (value.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(value)) {
    return true;
  }
  // Relative paths with directory separators
  if (value.includes('/') || value.includes('\\')) {
    // But not URLs
    if (value.includes('://')) {
      return false;
    }
    return true;
  }
  // Common file extensions
  if (/\.(ts|js|tsx|jsx|json|md|html|css|scss|less|yaml|yml)$/i.test(value)) {
    return true;
  }
  return false;
}

/**
 * Check if a string looks like a URL.
 */
function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('//');
}

/**
 * Check if a string might contain sensitive data.
 */
function mightBeSensitive(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('key') ||
    lower.includes('auth') ||
    lower.includes('credential') ||
    // Base64-like strings (potential tokens)
    /^[A-Za-z0-9+/=]{20,}$/.test(value) ||
    // Hex strings (potential hashes/tokens)
    /^[a-f0-9]{32,}$/i.test(value)
  );
}

/**
 * Sanitize a single argument value.
 * Returns REDACTED if the value might be sensitive.
 */
export function sanitizeValue(
  value: string,
  flagName?: string
): SanitizedValue {
  // Empty values are safe
  if (!value) {
    return value;
  }

  // Check if flag is known sensitive
  if (flagName && SENSITIVE_FLAGS.has(flagName)) {
    return REDACTED;
  }

  // Check if flag is known safe
  if (flagName && SAFE_FLAGS.has(flagName)) {
    // Even safe flags shouldn't contain paths or URLs
    if (looksLikePath(value) || looksLikeUrl(value)) {
      return REDACTED;
    }
    return value;
  }

  // Redact paths
  if (looksLikePath(value)) {
    return REDACTED;
  }

  // Redact URLs (except protocol)
  if (looksLikeUrl(value)) {
    return REDACTED;
  }

  // Redact potentially sensitive strings
  if (mightBeSensitive(value)) {
    return REDACTED;
  }

  // Check if it looks like a boolean
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  // Check if it looks like a number
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') {
    return num;
  }

  // For unknown flags, be conservative and redact
  if (!flagName || !SAFE_FLAGS.has(flagName)) {
    // Allow short values that are likely option names
    if (value.length <= 20 && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(value)) {
      return value;
    }
    return REDACTED;
  }

  return value;
}

/**
 * Sanitize a target name.
 * Standard targets are returned as-is, custom targets become '[custom]'.
 */
export function sanitizeTarget(target: string): string {
  if (!target) {
    return target;
  }
  return STANDARD_TARGETS.has(target) ? target : CUSTOM;
}

/**
 * Sanitize a configuration name.
 * Standard configurations are returned as-is, custom configs become '[custom]'.
 */
export function sanitizeConfiguration(config: string): string {
  if (!config) {
    return config;
  }
  return STANDARD_CONFIGS.has(config) ? config : CUSTOM;
}

/**
 * Check if a plugin/generator name is from a known Nx package.
 */
export function isKnownPlugin(name: string): boolean {
  return KNOWN_PLUGIN_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Sanitize a generator name.
 * Known Nx generators are returned as-is, custom generators are redacted.
 */
export function sanitizeGeneratorName(generator: string): string {
  if (!generator) {
    return generator;
  }
  if (isKnownPlugin(generator)) {
    return generator;
  }
  return CUSTOM;
}

/**
 * Parse command line arguments into a structured format.
 */
function parseArgv(argv: string[]): {
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      // Long flag
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        // --flag=value
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        flags[key] = value;
      } else if (arg.startsWith('--no-')) {
        // --no-flag (boolean false)
        const key = arg.slice(5);
        flags[key] = false;
      } else {
        // --flag or --flag value
        const key = arg.slice(2);
        const nextArg = argv[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          flags[key] = nextArg;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flag: -f or -f value
      const key = arg.slice(1);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      // Positional argument
      positional.push(arg);
    }

    i++;
  }

  return { positional, flags };
}

/**
 * Sanitize positional arguments based on command context.
 */
function sanitizePositional(
  positional: string[],
  command: string
): string[] {
  const result: string[] = [];

  for (let i = 0; i < positional.length; i++) {
    const arg = positional[i];

    // First positional is usually the command - keep if known
    if (i === 0) {
      result.push(KNOWN_COMMANDS.has(arg) ? arg : CUSTOM);
      continue;
    }

    // For generate command, second positional is generator name
    if ((command === 'generate' || command === 'g') && i === 1) {
      result.push(sanitizeGeneratorName(arg));
      continue;
    }

    // For run/build/test/etc, second positional might be project:target:config
    if (
      ['run', 'build', 'serve', 'test', 'lint', 'e2e'].includes(command) &&
      i === 1
    ) {
      const parts = arg.split(':');
      if (parts.length >= 1) {
        const sanitizedParts = [
          anonymizeProjectName(parts[0]),
          parts[1] ? sanitizeTarget(parts[1]) : undefined,
          parts[2] ? sanitizeConfiguration(parts[2]) : undefined,
        ].filter(Boolean);
        result.push(sanitizedParts.join(':'));
        continue;
      }
    }

    // For affected/run-many, positional args are usually options
    // Default: redact positional args as they might contain project names
    result.push(REDACTED);
  }

  return result;
}

/**
 * Sanitize command-line arguments for telemetry.
 *
 * This function:
 * - Parses arguments into positional and flags
 * - Sanitizes each based on context (command, generator, etc.)
 * - Redacts sensitive values (paths, tokens, etc.)
 * - Anonymizes project names
 *
 * @param argv The raw command-line arguments (without 'nx' prefix)
 * @returns Sanitized arguments safe for telemetry
 */
export function sanitizeArgs(argv: string[]): SanitizedArgs {
  if (!argv || argv.length === 0) {
    return { positional: [], flags: {} };
  }

  const { positional, flags } = parseArgv(argv);

  // Determine the command (first positional)
  const command = positional[0] || '';

  // Check if this is a generator command
  const isGenerator = command === 'generate' || command === 'g';
  const generatorName = isGenerator ? positional[1] : undefined;

  // Get generator-specific arg specs if applicable
  const generatorSpec = generatorName
    ? getGeneratorArgSpec(generatorName)
    : undefined;

  // Sanitize positional arguments
  const sanitizedPositional = sanitizePositional(positional, command);

  // Sanitize flags
  const sanitizedFlags: Record<string, SanitizedValue> = {};

  for (const [key, value] of Object.entries(flags)) {
    // For generators, use the generator-specific spec
    if (generatorSpec) {
      if (generatorSpec.safeArgs.has(key)) {
        // Safe to include as-is
        sanitizedFlags[key] =
          typeof value === 'boolean' ? value : sanitizeValue(String(value), key);
      } else if (generatorSpec.presenceOnlyArgs.has(key)) {
        // Only record presence, not value
        sanitizedFlags[key] = true;
      } else if (generatorSpec.categorizedArgs.has(key)) {
        // Value should be one of known categories
        const categories = generatorSpec.categorizedArgs.get(key)!;
        sanitizedFlags[key] =
          typeof value === 'string' && categories.has(value)
            ? value
            : REDACTED;
      } else {
        // Unknown arg - redact value, keep presence
        sanitizedFlags[key] = REDACTED;
      }
    } else {
      // Non-generator command - use general sanitization
      if (typeof value === 'boolean') {
        sanitizedFlags[key] = value;
      } else {
        sanitizedFlags[key] = sanitizeValue(String(value), key);
      }
    }
  }

  return {
    positional: sanitizedPositional,
    flags: sanitizedFlags,
  };
}

/**
 * Sanitize an error message by removing potentially sensitive information.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) {
    return message;
  }

  let sanitized = message;

  // Remove URLs first (keep protocol but redact the rest)
  // Must be done before path replacement to avoid partial matching
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, (match) => {
    try {
      const url = new URL(match);
      return `${url.protocol}//${REDACTED}`;
    } catch {
      return REDACTED;
    }
  });

  // Remove potential tokens/secrets (long alphanumeric strings)
  sanitized = sanitized.replace(/[A-Za-z0-9+/=]{40,}/g, REDACTED);

  // Remove email addresses - require at least one char before @ that isn't /
  // to avoid matching scoped npm packages like @nx/react
  sanitized = sanitized.replace(/[^\s@/]+@[^\s@/]+\.[^\s@/]+/g, REDACTED);

  // Remove file paths (Unix) - but keep node_modules paths
  // Match absolute paths or relative paths with directory separators
  // Include @ for scoped npm packages like @nx/react
  sanitized = sanitized.replace(
    /\/(?:[@\w.-]+\/)+[@\w.-]+/g,
    (match) => {
      // Check if this is a node_modules path
      const nodeModulesIndex = match.indexOf('node_modules');
      if (nodeModulesIndex !== -1) {
        // Keep everything from node_modules onward
        return match.slice(nodeModulesIndex);
      }
      return REDACTED;
    }
  );

  // Remove file paths (Windows)
  sanitized = sanitized.replace(/[A-Za-z]:\\[^\s:]+/g, (match) => {
    const nodeModulesIndex = match.indexOf('node_modules');
    if (nodeModulesIndex !== -1) {
      return match.slice(nodeModulesIndex);
    }
    return REDACTED;
  });

  return sanitized;
}

/**
 * Sanitize a stack trace by removing user paths while keeping node_modules paths.
 */
export function sanitizeStackTrace(stack: string): string {
  if (!stack) {
    return stack;
  }

  const lines = stack.split('\n');
  const sanitizedLines = lines.map((line) => {
    // Keep the error message line mostly intact (first line)
    if (!line.trim().startsWith('at ')) {
      return sanitizeErrorMessage(line);
    }

    // For stack trace lines, handle paths
    return line.replace(/\(([^)]+)\)|at\s+([^\s]+)/g, (match, paren, at) => {
      const path = paren || at;
      if (!path) return match;

      // Keep node_modules paths from node_modules onward
      const nodeModulesIndex = path.indexOf('node_modules');
      if (nodeModulesIndex !== -1) {
        const keptPath = path.slice(nodeModulesIndex);
        return paren ? `(${keptPath})` : `at ${keptPath}`;
      }

      // Redact user paths but keep line/column numbers
      const lineColMatch = path.match(/:(\d+:\d+)$/);
      const lineCol = lineColMatch ? lineColMatch[1] : '';
      return paren
        ? `(${REDACTED}${lineCol ? ':' + lineCol : ''})`
        : `at ${REDACTED}${lineCol ? ':' + lineCol : ''}`;
    });
  });

  return sanitizedLines.join('\n');
}
