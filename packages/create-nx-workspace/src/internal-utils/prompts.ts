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

/**
 * `@clack/prompts` is ESM-only. A static import would compile to `require()`
 * under CommonJS emit and throw ERR_REQUIRE_ESM; `module: nodenext` preserves
 * this dynamic form.
 */
async function prompts() {
  return await import('@clack/prompts');
}

/** Ctrl+C returns a sentinel rather than throwing, so every prompt must check. */
function assertNotCancelled<T>(
  value: T | symbol,
  isCancel: (v: unknown) => boolean
): T {
  if (isCancel(value)) {
    throw new CnwError('CANCELLED', 'Cancelled.');
  }
  return value as T;
}

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
    const { autocomplete, isCancel } = await prompts();
    const reply = assertNotCancelled(
      await autocomplete({
        validate: (value) =>
          value === undefined ? 'Pick one of the listed options' : undefined,
        message: 'Will you be using GitHub as your git hosting provider?',
        options: [
          { value: 'Yes', label: 'Yes' },
          { value: 'No', label: 'No' },
        ],
      }),
      isCancel
    );
    return reply === 'Yes';
  }
  return false;
}

async function nxCloudPrompt(key: MessageKey): Promise<NxCloud> {
  const { message, choices, initial, fallback, footer, hint } =
    messages.getPrompt(key);

  const { autocomplete, isCancel } = await prompts();

  // No separate footer/hint slot, so both are folded into the message.
  const suffix = [hint, footer].filter(Boolean).map((t) => chalk.dim(t));
  const answer = assertNotCancelled(
    await autocomplete({
      validate: (value) =>
        value === undefined ? 'Pick one of the listed options' : undefined,
      message: [message, ...suffix].join('\n'),
      // These choices are `{ value, name }` with `name` as the display text —
      // the inverse of enquirer's usual `{ name, message }`. Take `value` so
      // the answer is the key the caller compares against, not the label.
      options: (choices as any[]).map((c) =>
        typeof c === 'string'
          ? { value: c, label: c }
          : { value: c.value ?? c.name, label: c.message ?? c.name ?? c.value }
      ),
      initialValue:
        (choices as any[])[initial ?? 0]?.value ??
        (choices as any[])[initial ?? 0]?.name,
    }),
    isCancel
  ) as NxCloud;

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
  const { autocomplete, isCancel } = await prompts();
  return assertNotCancelled(
    await autocomplete({
      validate: (value) =>
        value === undefined ? 'Pick one of the listed options' : undefined,
      message: 'Which starter do you want to use?',
      options: [
        {
          value: 'nrwl/empty-template',
          label: 'Minimal           (empty monorepo without projects)',
        },
        {
          value: 'nrwl/react-template',
          label:
            'React             (fullstack monorepo with React and Express)',
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
          label:
            'Custom            (advanced setup with additional frameworks)',
        },
      ],
      initialValue: 'nrwl/empty-template',
    }),
    isCancel
  );
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
  const { multiselect, isCancel } = await prompts();
  return assertNotCancelled(
    await multiselect<Agent>({
      message: 'Which AI agents, if any, would you like to set up?',
      options: supportedAgents.map((a) => ({
        value: a,
        label: agentDisplayMap[a],
      })),
      required: false,
    }),
    isCancel
  );
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

  const { autocomplete, isCancel } = await prompts();
  const enableAnalytics = assertNotCancelled(
    await autocomplete({
      validate: (value) =>
        value === undefined ? 'Pick one of the listed options' : undefined,
      message: 'Help improve Nx by sharing your usage data?',
      options: [
        { value: 'Yes', label: 'Yes' },
        { value: 'No', label: 'No' },
      ],
      initialValue: 'Yes',
    }),
    isCancel
  );
  return enableAnalytics === 'Yes' ? 'yes' : 'no';
}

export async function determineDefaultBase(
  parsedArgs: yargs.Arguments<{ defaultBase?: string }>
): Promise<string> {
  if (parsedArgs.defaultBase) {
    return parsedArgs.defaultBase;
  } else if (parsedArgs.allPrompts) {
    const { text, isCancel } = await prompts();
    const defaultBase = assertNotCancelled(
      await text({
        message: `Main branch name`,
        initialValue: `main`,
      }),
      isCancel
    );
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

  const { autocomplete, isCancel } = await prompts();
  const confirm = assertNotCancelled(
    await autocomplete({
      validate: (value) =>
        value === undefined ? 'Pick one of the listed options' : undefined,
      message: `Install third-party preset '${packageName}'?`,
      options: [
        { value: 'No', label: 'No' },
        { value: 'Yes', label: 'Yes' },
      ],
      initialValue: 'No',
    }),
    isCancel
  );
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
    const { autocomplete, isCancel } = await prompts();
    return assertNotCancelled(
      await autocomplete<PackageManager>({
        message: `Which package manager to use`,
        options: [
          { value: 'npm', label: 'NPM' },
          { value: 'yarn', label: 'Yarn' },
          { value: 'pnpm', label: 'PNPM' },
          { value: 'bun', label: 'Bun' },
        ],
        initialValue: 'npm',
      }),
      isCancel
    );
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

  const { autocomplete, isCancel } = await prompts();
  return assertNotCancelled(
    await autocomplete<Linter>({
      message: `Which linter would you like to use?`,
      // `value` is what's returned; `label` is what the list shows. Oxlint is
      // labelled so it isn't presented as an equal of ESLint while the docs and
      // the package both call it experimental.
      options: [
        { value: 'eslint', label: 'eslint' },
        { value: 'oxlint', label: 'oxlint (experimental)' },
        { value: 'none', label: 'none' },
      ],
      initialValue: 'eslint',
    }),
    isCancel
  );
}
