import * as yargs from 'yargs';
import * as enquirer from 'enquirer';
import * as chalk from 'chalk';

import {
  MessageKey,
  messages,
  shouldUseTemplateFlow,
} from '../utils/nx/ab-testing';
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
import { CnwError } from '../utils/error-utils';

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
): Promise<'github' | 'skip'> {
  // Provided via flag
  if (parsedArgs.nxCloud) {
    return parsedArgs.nxCloud === 'skip' ? 'skip' : 'github';
  }

  // Non-interactive mode
  if (!parsedArgs.interactive || isCI()) {
    return 'skip';
  }

  // Show simplified prompt
  const { message, choices, initial, footer, hint } =
    messages.getPrompt('setupNxCloudV2');

  const promptConfig = {
    name: 'nxCloud',
    message,
    type: 'autocomplete',
    choices,
    initial,
  } as any; // types in enquirer are not up to date
  if (footer) {
    promptConfig.footer = () => footer;
  }
  if (hint) {
    promptConfig.hint = () => hint;
  }

  const result = await enquirer.prompt<{ nxCloud: 'github' | 'skip' }>([
    promptConfig,
  ]);
  return result.nxCloud;
}

export async function determineIfGitHubWillBeUsed(
  parsedArgs: yargs.Arguments<{ nxCloud: NxCloud; useGitHub?: boolean }>
): Promise<boolean> {
  if (parsedArgs.nxCloud === 'yes' || parsedArgs.nxCloud === 'circleci') {
    if (parsedArgs?.useGitHub) return true;
    const reply = await enquirer.prompt<{ github: 'Yes' | 'No' }>([
      {
        name: 'github',
        message: 'Will you be using GitHub as your git hosting provider?',
        type: 'autocomplete',
        choices: [{ name: 'Yes' }, { name: 'No' }],
        initial: 0,
      },
    ]);
    return reply.github === 'Yes';
  }
  return false;
}

async function nxCloudPrompt(key: MessageKey): Promise<NxCloud> {
  const { message, choices, initial, fallback, footer, hint } =
    messages.getPrompt(key);

  const promptConfig = {
    name: 'NxCloud',
    message,
    type: 'autocomplete',
    choices,
    initial,
  } as any; // meeroslav: types in enquirer are not up to date
  if (footer) {
    promptConfig.footer = () => chalk.dim(footer);
  }
  if (hint) {
    promptConfig.hint = () => chalk.dim(hint);
  }

  return enquirer.prompt<{ NxCloud: NxCloud }>([promptConfig]).then((a) => {
    if (fallback && a.NxCloud === fallback.value) {
      return nxCloudPrompt(fallback.key);
    }
    return a.NxCloud;
  });
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
  if (!parsedArgs.interactive || isCI()) return 'custom';
  // A/B test: shouldUseTemplateFlow() determines if user sees template or preset flow
  if (!shouldUseTemplateFlow()) return 'custom';
  const { template } = await enquirer.prompt<{ template: string }>([
    {
      name: 'template',
      message: 'Which starter do you want to use?',
      type: 'autocomplete',
      choices: [
        {
          name: 'nrwl/empty-template',
          message: 'Minimal           (empty monorepo without projects)',
        },
        {
          name: 'nrwl/react-template',
          message:
            'React             (fullstack monorepo with React and Express)',
        },
        {
          name: 'nrwl/angular-template',
          message:
            'Angular           (fullstack monorepo with Angular and Express)',
        },
        {
          name: 'nrwl/typescript-template',
          message:
            'NPM Packages      (monorepo with TypeScript packages ready to publish)',
        },
        {
          name: 'custom',
          message:
            'Custom            (advanced setup with additional frameworks)',
        },
      ],
      initial: 0,
    },
  ]);

  return template;
}

export async function determineAiAgents(
  parsedArgs: yargs.Arguments<{ aiAgents?: Agent[]; interactive?: boolean }>
): Promise<Agent[]> {
  return parsedArgs.aiAgents ?? [];
}

async function aiAgentsPrompt(): Promise<Agent[]> {
  const promptConfig: Parameters<typeof enquirer.prompt>[0] & {
    footer: () => void;
  } = {
    name: 'agents',
    message: 'Which AI agents, if any, would you like to set up?',
    type: 'multiselect',
    choices: supportedAgents.map((a) => ({
      name: a,
      message: agentDisplayMap[a],
    })),
    footer: () =>
      chalk.dim(
        'Multiple selections possible. <Space> to select. <Enter> to confirm.'
      ),
  };
  return (await enquirer.prompt<{ agents: Agent[] }>([promptConfig])).agents;
}

export async function determineDefaultBase(
  parsedArgs: yargs.Arguments<{ defaultBase?: string }>
): Promise<string> {
  if (parsedArgs.defaultBase) {
    return parsedArgs.defaultBase;
  } else if (parsedArgs.allPrompts) {
    return enquirer
      .prompt<{ DefaultBase: string }>([
        {
          name: 'DefaultBase',
          message: `Main branch name`,
          initial: `main`,
          type: 'input',
        },
      ])
      .then((a) => {
        if (!a.DefaultBase) {
          throw new CnwError(
            'INVALID_BRANCH_NAME',
            'Branch name cannot be empty'
          );
        }
        return a.DefaultBase;
      });
  }
  return deduceDefaultBase();
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
    return enquirer
      .prompt<{ packageManager: PackageManager }>([
        {
          name: 'packageManager',
          message: `Which package manager to use`,
          initial: 0,
          type: 'autocomplete',
          choices: [
            { name: 'npm', message: 'NPM' },
            { name: 'yarn', message: 'Yarn' },
            { name: 'pnpm', message: 'PNPM' },
            { name: 'bun', message: 'Bun' },
          ],
        },
      ])
      .then((a) => a.packageManager);
  }

  return detectInvokedPackageManager();
}
