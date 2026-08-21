import yargs from 'yargs';
import chalk from 'chalk';

import { MessageKey, messages } from '../utils/nx/ab-testing';
import { deduceDefaultBase } from '../utils/git/default-base';
import {
  detectInvokedPackageManager,
  PackageManager,
  packageManagerList,
} from '../utils/package-manager';
import { stringifyCollection } from '../utils/string-utils';
import { NxCloud } from '../utils/nx/nx-cloud';
import { isCI } from '../utils/ci/is-ci';
import {
  Agent,
  agentDisplayMap,
  supportedAgents,
} from '../create-workspace-options';
import { detectAiAgentName, isAiAgent } from '../utils/ai/ai-output';
import { CnwError } from '../utils/error-utils';
import { output } from '../utils/output';
import {
  confirmationPrompt,
  multiselectPrompt,
  selectPrompt,
  textPrompt,
} from './prompt-helpers';

export async function determineNxCloud(
  parsedArgs: yargs.Arguments<{ nxCloud: NxCloud }>
): Promise<NxCloud> {
  if (parsedArgs.nxCloud) {
    return parsedArgs.nxCloud;
  } else if (!parsedArgs.interactive || isCI()) {
    return 'skip';
  } else {
    return nxCloudPrompt('setupCI');
  }
}

export async function determineNxCloudV2(
  parsedArgs: yargs.Arguments<{ nxCloud?: string; interactive?: boolean }>
): Promise<'yes' | 'skip' | 'never'> {
  // Provided via flag
  if (parsedArgs.nxCloud) {
    if (parsedArgs.nxCloud === 'skip') return 'skip';
    if (parsedArgs.nxCloud === 'never') return 'never';
    return 'yes';
  }

  // Non-interactive mode
  if (!parsedArgs.interactive || isCI()) {
    return 'skip';
  }

  const result = await nxCloudPrompt('setupNxCloudV2');
  if (result === 'never') return 'never';
  if (result === 'skip') return 'skip';
  return 'yes';
}

export async function determineIfGitHubWillBeUsed(
  parsedArgs: yargs.Arguments<{ nxCloud: NxCloud; useGitHub?: boolean }>
): Promise<boolean> {
  if (parsedArgs.nxCloud === 'yes' || parsedArgs.nxCloud === 'circleci') {
    if (parsedArgs?.useGitHub) return true;
    return confirmationPrompt({
      message: 'Will you be using GitHub as your git hosting provider?',
    });
  }
  return false;
}

async function nxCloudPrompt(key: MessageKey): Promise<NxCloud> {
  const { message, choices, initial, fallback, footer } =
    messages.getPrompt(key);

  // These choices are `{ value, name }` with `name` as the display text — the
  // inverse of enquirer's usual `{ name, message }`. Take `value` so the answer
  // is the key the caller compares against, not the label.
  const options = (choices as any[]).map((c) =>
    typeof c === 'string'
      ? { value: c }
      : { value: c.value ?? c.name, label: c.message ?? c.name ?? c.value }
  );

  const answer = (await selectPrompt({
    // No separate footer slot, so it is folded into the message.
    message: `${message}\n${chalk.dim(footer)}`,
    choices: options,
    initial: options[initial ?? 0]?.value,
  })) as NxCloud;

  if (fallback && answer === fallback.value) {
    return nxCloudPrompt(fallback.key);
  }
  return answer;
}

export async function determineTemplate(
  parsedArgs: yargs.Arguments<{
    template?: string;
    preset?: string;
    interactive?: boolean;
  }>
): Promise<string | 'custom'> {
  if (parsedArgs.template) return parsedArgs.template;
  if (parsedArgs.preset) return 'custom';
  if (!parsedArgs.interactive || isCI()) return 'nrwl/empty-template';
  // Docs generation needs preset flow to document all presets
  if (process.env.NX_GENERATE_DOCS_PROCESS === 'true') return 'custom';
  return selectPrompt({
    message: 'Which starter do you want to use?',
    choices: [
      {
        value: 'nrwl/empty-template',
        label: 'Minimal           (empty monorepo without projects)',
      },
      {
        value: 'nrwl/react-template',
        label: 'React             (fullstack monorepo with React and Express)',
      },
      {
        value: 'nrwl/angular-template',
        label:
          'Angular           (fullstack monorepo with Angular and Express)',
      },
      {
        value: 'nrwl/typescript-template',
        label:
          'NPM Packages      (monorepo with TypeScript packages ready to publish)',
      },
      {
        value: 'custom',
        label: 'Custom            (advanced setup with additional frameworks)',
      },
    ],
    initial: 'nrwl/empty-template',
  });
}

export async function determineAiAgents(
  parsedArgs: yargs.Arguments<{
    aiAgents?: (Agent | 'none')[];
    interactive?: boolean;
  }>
): Promise<Agent[]> {
  if (parsedArgs.aiAgents) {
    const filtered = parsedArgs.aiAgents.filter((a) => a !== 'none') as Agent[];
    if (filtered.length > 0) {
      return filtered;
    }
    return [];
  }
  const detected = detectAiAgentName();
  if (detected) {
    return [detected as Agent];
  }
  return [];
}

async function aiAgentsPrompt(): Promise<Agent[]> {
  return multiselectPrompt<Agent>({
    message: 'Which AI agents, if any, would you like to set up?',
    choices: supportedAgents.map((a) => ({
      value: a,
      label: agentDisplayMap[a],
    })),
    required: false,
  });
}

export async function determineAnalytics(
  parsedArgs: yargs.Arguments<{ analytics?: boolean }>
): Promise<'yes' | 'no' | 'unset'> {
  if (typeof parsedArgs.analytics === 'boolean') {
    return parsedArgs.analytics ? 'yes' : 'no';
  }

  if (!parsedArgs.interactive || isCI()) {
    // Not asked in non-interactive/CI.
    return 'unset';
  }

  const enableAnalytics = await selectPrompt({
    message: 'Help improve Nx by sharing your usage data?',
    choices: [
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' },
    ],
    initial: 'Yes',
  });
  return enableAnalytics === 'Yes' ? 'yes' : 'no';
}

export async function determineDefaultBase(
  parsedArgs: yargs.Arguments<{ defaultBase?: string }>
): Promise<string> {
  if (parsedArgs.defaultBase) {
    return parsedArgs.defaultBase;
  } else if (parsedArgs.allPrompts) {
    const defaultBase = await textPrompt({
      message: `Main branch name`,
      initialValue: `main`,
      // Reject here so clearing the field re-prompts rather than aborting the
      // run on the throw below.
      validate: (value) =>
        value.trim() ? undefined : 'Branch name cannot be empty',
    });
    if (!defaultBase) {
      throw new CnwError('INVALID_BRANCH_NAME', 'Branch name cannot be empty');
    }
    return defaultBase;
  }
  return deduceDefaultBase();
}

/**
 * Confirm with the user before installing a third-party preset npm package.
 *
 * `--preset=<name>` will install any npm package whose name matches when the
 * preset is not a known Nx preset. A typo (e.g. `--preset=core`) can silently
 * install an unrelated package from the registry, which is a supply-chain
 * risk. This prompt makes that step explicit.
 *
 * In non-interactive / CI / AI-agent contexts we cannot prompt, so we emit a
 * warning and proceed — automated workflows like
 * `--preset=@my-org/nx-plugin --no-interactive` keep working, but the warning
 * still appears in the logs.
 */
export async function confirmThirdPartyPreset(
  packageName: string,
  interactive: boolean | undefined,
  trusted?: boolean
): Promise<boolean> {
  if (trusted) {
    return true;
  }

  output.warn({
    title: `About to install '${packageName}' from the npm registry as a preset.`,
    bodyLines: [
      `'${packageName}' is not a built-in Nx preset.`,
      `Nx will download this npm package and run its preset generator.`,
      `Only proceed if you trust the publisher of '${packageName}'.`,
    ],
  });

  if (interactive === false || isCI() || isAiAgent()) {
    return true;
  }

  const confirm = await selectPrompt({
    message: `Install third-party preset '${packageName}'?`,
    choices: [
      { value: 'No', label: 'No' },
      { value: 'Yes', label: 'Yes' },
    ],
    initial: 'No',
  });
  return confirm === 'Yes';
}

export async function determinePackageManager(
  parsedArgs: yargs.Arguments<{ packageManager: string }>
): Promise<PackageManager> {
  const packageManager: string = parsedArgs.packageManager;

  if (packageManager) {
    if (packageManagerList.includes(packageManager as PackageManager)) {
      return packageManager as PackageManager;
    }
    throw new CnwError(
      'INVALID_PACKAGE_MANAGER',
      `Package manager must be one of ${stringifyCollection([
        ...packageManagerList,
      ])}`
    );
  } else if (parsedArgs.allPrompts) {
    return selectPrompt<PackageManager>({
      message: `Which package manager to use`,
      choices: [
        { value: 'npm', label: 'NPM' },
        { value: 'yarn', label: 'Yarn' },
        { value: 'pnpm', label: 'PNPM' },
        { value: 'bun', label: 'Bun' },
      ],
      initial: 'npm',
    });
  }

  return detectInvokedPackageManager();
}

/**
 * Mirrors `LinterType` in `@nx/js`, which this package cannot depend on.
 * One array so the type and the yargs `choices` gate cannot drift apart.
 */
export const LINTERS = ['eslint', 'oxlint', 'none'] as const;
export type Linter = (typeof LINTERS)[number];

export async function determineLinterOptions(args: {
  linter?: Linter;
  interactive?: boolean;
}): Promise<Linter> {
  if (args.linter) return args.linter;

  // ESLint is the non-interactive default; changing it means changing this
  // line, not the option order.
  if (!args.interactive || isCI()) return 'eslint';

  return selectPrompt<Linter>({
    message: `Which linter would you like to use?`,
    // `value` is what's returned; `label` is what the list shows. Oxlint is
    // labelled so it isn't presented as an equal of ESLint while the docs and
    // the package both call it experimental.
    choices: [
      { value: 'eslint', label: 'eslint' },
      { value: 'oxlint', label: 'oxlint (experimental)' },
      { value: 'none', label: 'none' },
    ],
    initial: 'eslint',
  });
}

// Kept in sync with the formatter enum in the generator schemas by hand - this
// package deliberately has no `nx` dependency, so nx's `FormatterType` cannot
// be imported here.
export type Formatter = 'oxfmt' | 'prettier' | 'none';

// Order here is incidental; the prompt's own choice order sets the default. `satisfies` stops a typo
// getting in, and the coverage assertion below stops a member being dropped -
// on its own the array would happily be a subset, and the prompt would then
// reject a value the generator schemas still accept.
export const FORMATTERS = [
  'oxfmt',
  'prettier',
  'none',
] as const satisfies readonly Formatter[];

type MissingFormatter = Exclude<Formatter, (typeof FORMATTERS)[number]>;
const _formattersAreExhaustive: MissingFormatter extends never ? true : never =
  true;

export async function determineFormatterOptions(args: {
  formatter?: Formatter;
  interactive?: boolean;
}): Promise<Formatter> {
  if (args.formatter) return args.formatter;

  // Prettier is the non-interactive default; changing it means changing this
  // line, not the option order.
  if (!args.interactive || isCI()) return 'prettier';

  return selectPrompt<Formatter>({
    message: `Which code formatter would you like to use?`,
    // `value` is what's returned; `label` is what the list shows. oxfmt is
    // labelled so it isn't presented as an equal of Prettier while it is
    // pre-1.0.
    choices: [
      { value: 'prettier', label: 'prettier' },
      { value: 'oxfmt', label: 'oxfmt (experimental)' },
      { value: 'none', label: 'none' },
    ],
    initial: 'prettier',
  });
}
