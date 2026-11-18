import * as pc from 'picocolors';
import {
  ConformanceRuleResultSeverity,
  ConformanceRuleResultWithRuleAndRunnerData,
} from '../types';

// Credit to https://github.com/sindresorhus/is-unicode-supported/blob/e0373335038856c63034c8eef6ac43ee3827a601/index.js
function isUnicodeSupported() {
  const { env } = process;
  const { TERM, TERM_PROGRAM } = env;
  if (process.platform !== 'win32') {
    return TERM !== 'linux'; // Linux console (kernel)
  }
  return (
    Boolean(env.WT_SESSION) || // Windows Terminal
    Boolean(env.TERMINUS_SUBLIME) || // Terminus (<0.2.27)
    env.ConEmuTask === '{cmd::Cmder}' || // ConEmu and cmder
    TERM_PROGRAM === 'Terminus-Sublime' ||
    TERM_PROGRAM === 'vscode' ||
    TERM === 'xterm-256color' ||
    TERM === 'alacritty' ||
    TERM === 'rxvt-unicode' ||
    TERM === 'rxvt-unicode-256color' ||
    env.TERMINAL_EMULATOR === 'JetBrains-JediTerm'
  );
}

const unicode = isUnicodeSupported();
const iconWithFallback = (c: string, fallback: string) =>
  unicode ? c : fallback;

export const BAR_START = iconWithFallback('┌', 'T');
export const BAR = iconWithFallback('│', '|');
export const BAR_END = iconWithFallback('└', '—');
export const SQUARE = iconWithFallback('◼', '■');
export const WORKSPACE = iconWithFallback('🌐', 'W');

export const getColorForSeverity = (
  severity: ConformanceRuleResultSeverity
) => {
  switch (severity) {
    case 'high':
      return pc.red;
    case 'medium':
      return pc.yellow;
    case 'low':
      return pc.cyan;
    default:
      return pc.white;
  }
};

export const getIconForSeverity = (severity: ConformanceRuleResultSeverity) => {
  const defaultIcon = iconWithFallback('●', '•');
  switch (severity) {
    case 'high':
      return iconWithFallback('✘', '×');
    case 'medium':
      return iconWithFallback('▲', '!');
    case 'low':
      return defaultIcon;
    default:
      return defaultIcon;
  }
};

export function printNoViolations(
  result: ConformanceRuleResultWithRuleAndRunnerData
) {
  const isDisabled = result.runnerData.status === 'disabled';
  const noViolationsColor = isDisabled ? pc.gray : pc.green;
  console.log(
    ` ${noViolationsColor(BAR_START)}  ${noViolationsColor(
      pc.bold(getNameToPrint(result))
    )} ${pc.dim('-')} ${result.ruleData.category}${
      result.severity ? ` ${pc.dim('|')} ${result.severity} severity` : ''
    } ${pc.dim('|')} status: ${getStatusToPrint(result)}${
      result.runnerData.executionTimeMs
        ? pc.dim(` (${formatExecutionTime(result.runnerData.executionTimeMs)})`)
        : ''
    }`
  );
  console.log(
    ` ${noViolationsColor(BAR_END)}  ${pc.dim(
      isDisabled
        ? 'This rule is disabled and therefore was never executed.'
        : 'No violations found.'
    )}`
  );
}

// Keep the namespace of built-in and Nx Cloud rules to tell them apart from custom rules
export function getNameToPrint(
  result: ConformanceRuleResultWithRuleAndRunnerData
) {
  return result.ruleSpecifier &&
    (result.ruleSpecifier.startsWith('@nx/conformance/') ||
      result.ruleSpecifier.startsWith('@nx/owners/') ||
      result.ruleSpecifier.startsWith('nx-cloud:'))
    ? result.ruleSpecifier
    : result.ruleData.name;
}

// For Nx Cloud Enterprise users leveraging scheduled statuses, we need to call attention to upcoming changes
export function getStatusToPrint(
  result: ConformanceRuleResultWithRuleAndRunnerData
) {
  let statusToPrint = result.resolvedStatus;
  // There is no scheduled status that is applicable, so there is no additional information to print
  if (!result.runnerData.scheduledStatusDate) {
    return statusToPrint;
  }

  const scheduledStatusDate = new Date(result.runnerData.scheduledStatusDate);
  const date = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(scheduledStatusDate);

  if (result.resolvedStatus === result.runnerData.status) {
    // The resolved status is still the same as the configured status, so the scheduled change must still be upcoming
    statusToPrint += ` ${pc.red(
      `[Status will change to ${result.runnerData.scheduledStatus} on ${date} UTC]`
    )}`;
  } else if (result.resolvedStatus === result.runnerData.scheduledStatus) {
    // The resolved status is the same as the scheduled status, so the scheduled change must have already occurred
    statusToPrint += ` ${pc.red(
      `[Status changed from ${result.runnerData.status} on ${date} UTC]`
    )}`;
  }

  return statusToPrint;
}

export function formatExecutionTime(executionTimeMs: number): string {
  if (executionTimeMs < 1000) {
    return `${executionTimeMs}ms`;
  }
  return `${(executionTimeMs / 1000).toFixed(2)}s`;
}
