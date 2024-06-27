import { Fragment, ReactNode, useMemo, useState } from 'react';
import { PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Transition } from '@headlessui/react';
import { getExternalApiService, useEnvironmentConfig } from '@nx/graph/shared';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';
import { TerminalOutput } from '@nx/nx-dev/ui-fence';
import { Tooltip } from '@nx/graph/ui-tooltips';
import { TooltipTriggerText } from '../target-configuration-details/tooltip-trigger-text';

interface ShowOptionsHelpProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
}

const fallbackHelpExample = {
  options: {
    silent: true,
  },
  args: ['foo'],
};

export function ShowOptionsHelp({
  projectName,
  targetName,
  targetConfiguration,
}: ShowOptionsHelpProps) {
  const config = useEnvironmentConfig();
  const environment = config?.environment;
  const localMode = config?.localMode;
  const [result, setResult] = useState<{
    text: string;
    success: boolean;
  } | null>(null);
  const [isPending, setPending] = useState(false);
  const externalApiService = getExternalApiService();

  const helpData = targetConfiguration.metadata?.help;
  const helpCommand = helpData?.command;
  const helpExampleOptions = helpData?.example?.options;
  const helpExampleArgs = helpData?.example?.args;

  const helpExampleTest = useMemo(() => {
    const targetExampleJson =
      helpExampleOptions || helpExampleArgs
        ? {
            options: helpExampleOptions,
            args: helpExampleArgs,
          }
        : fallbackHelpExample;
    return JSON.stringify(
      {
        targets: {
          [targetName]: targetExampleJson,
        },
      },
      null,
      2
    );
  }, [helpExampleOptions, helpExampleArgs]);

  let runHelpActionElement: null | ReactNode;
  if (environment === 'docs') {
    // Cannot run help command when rendering in docs (e.g. nx.dev).
    runHelpActionElement = null;
  } else if (environment === 'release' && localMode === 'build') {
    // Cannot run help command when statically built via `nx graph --file=graph.html`.
    runHelpActionElement = null;
  } else if (isPending || !result) {
    runHelpActionElement = (
      <button
        className="flex items-center rounded-md border border-slate-500 px-1 disabled:opacity-75"
        disabled={isPending}
        onClick={
          environment === 'nx-console'
            ? () => {
                externalApiService.postEvent({
                  type: 'run-help',
                  payload: {
                    projectName,
                    targetName,
                    helpCommand,
                  },
                });
              }
            : async () => {
                setPending(true);
                const result = await fetch(
                  `/help?project=${encodeURIComponent(
                    projectName
                  )}&target=${encodeURIComponent(targetName)}`
                ).then((resp) => resp.json());
                setResult(result);
                setPending(false);
              }
        }
      >
        <PlayIcon className="mr-1 h-4 w-4" />
        Run
      </button>
    );
  } else {
    runHelpActionElement = (
      <button
        className="flex items-center rounded-md border border-slate-500 px-1"
        onClick={() => setResult(null)}
      >
        <XMarkIcon className="mr-1 h-4 w-4" />
        Clear output
      </button>
    );
  }

  return (
    helpCommand && (
      <>
        <p className="mb-4">
          Use <code>--help</code> to see all options for this command, and set
          them by{' '}
          <a
            className="text-blue-500 hover:underline"
            target="_blank"
            href="https://nx.dev/recipes/running-tasks/pass-args-to-commands#pass-args-to-commands"
          >
            passing them
          </a>{' '}
          to the <code>"options"</code> property in{' '}
          <Tooltip
            openAction="hover"
            content={
              (
                <div className="w-fit max-w-md">
                  <p className="mb-2">
                    For example, you can use the following configuration for the{' '}
                    <code>{targetName}</code> target in the{' '}
                    <code>project.json</code> file for{' '}
                    <span className="font-semibold">{projectName}</span>.
                  </p>
                  <pre className="mb-2 border border-slate-200 bg-slate-100/50 p-2 p-2 text-slate-400 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-500">
                    {helpExampleTest}
                  </pre>
                  {helpExampleOptions && (
                    <p className="mb-2">
                      The <code>options</code> are CLI options prefixed by{' '}
                      <code>--</code>, such as <code>ls --color=never</code>,
                      where you would use <code>{'"color": "never"'}</code> to
                      set it in the target configuration.
                    </p>
                  )}
                  {helpExampleArgs && (
                    <p className="mb-2">
                      The <code>args</code> are CLI positional arguments, such
                      as <code>ls somedir</code>, where you would use{' '}
                      <code>{'"args": ["somedir"]'}</code> to set it in the
                      target configuration.
                    </p>
                  )}
                </div>
              ) as any
            }
          >
            <code>
              <TooltipTriggerText>project.json</TooltipTriggerText>
            </code>
          </Tooltip>
          .
        </p>
        <TerminalOutput
          command={helpCommand}
          path={targetConfiguration.options.cwd ?? ''}
          actionElement={runHelpActionElement}
          content={
            <div className="relative w-full">
              <Transition
                show={!!result}
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <pre
                  className={result && !result.success ? 'text-red-500' : ''}
                >
                  {result?.text}
                </pre>
              </Transition>
            </div>
          }
        />
      </>
    )
  );
}
