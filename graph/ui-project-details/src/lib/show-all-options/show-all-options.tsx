import { Fragment, useState } from 'react';
import { PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Transition } from '@headlessui/react';
import { getExternalApiService, useEnvironmentConfig } from '@nx/graph/shared';
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';
import { TerminalOutput } from '@nx/nx-dev/ui-fence';
import { Tooltip } from '@nx/graph/ui-tooltips';
import { TooltipTriggerText } from '../target-configuration-details/tooltip-trigger-text';

interface ShowAllOptionsProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
}

const projectJsonViteHelpText = `{
  "targets": {
    "serve": {
      "options": {
        "open": "true",
        "port": 5000
      }
    },
    "test": {
      "options": {
        "args": ["run"]
      }
    }
  }
}`;

export function ShowAllOptions({
  projectName,
  targetName,
  targetConfiguration,
}: ShowAllOptionsProps) {
  const environment = useEnvironmentConfig()?.environment;
  const [result, setResult] = useState<string | null>(null);
  const [isPending, setPending] = useState(false);
  const externalApiService = getExternalApiService();

  const helpCommand = targetConfiguration.metadata?.help?.command;

  const runHelpCommand =
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
          const { result } = await fetch(
            `/help?project=${encodeURIComponent(
              projectName
            )}&target=${encodeURIComponent(targetName)}`
          ).then((resp) => resp.json());
          setResult(result);
          setPending(false);
        };

  const openProjectConfig =
    environment === 'nx-console'
      ? () => {
          externalApiService.postEvent({
            type: 'open-project-config',
            payload: {
              projectName,
              targetName,
            },
          });
        }
      : null;

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
                    For example, when using <code>@nx/vite/plugin</code>, the
                    following are options and args passed to <code>serve</code>{' '}
                    and <code>test</code> targets, which are then passed to the{' '}
                    <code className="font-semibold">vite</code> and{' '}
                    <code className="font-semibold">vitest</code> CLI
                    respectively.
                  </p>
                  <pre className="mb-2 border border-slate-200 bg-slate-100/50 p-2 p-2 text-slate-400 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-500">
                    {projectJsonViteHelpText}
                  </pre>
                  <p>
                    This configuration means <code>serve</code> runs{' '}
                    <code className="font-semibold">
                      vite --port=5000 --open
                    </code>
                    , and <code>test</code> runs{' '}
                    <code className="font-semibold">vitest run</code>.
                  </p>
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
          actionElement={
            isPending || !result ? (
              <button
                className="flex items-center rounded-md border border-slate-500 px-1 disabled:opacity-75"
                disabled={isPending}
                onClick={runHelpCommand}
              >
                <PlayIcon className="mr-1 h-4 w-4" />
                Run
              </button>
            ) : (
              <button
                className="flex items-center rounded-md border border-slate-500 px-1"
                onClick={() => setResult(null)}
              >
                <XMarkIcon className="mr-1 h-4 w-4" />
                Clear output
              </button>
            )
          }
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
                <pre className="">{result}</pre>
              </Transition>
            </div>
          }
        />
        {openProjectConfig && (
          <p className="mt-4">
            <button
              className="text-blue-500 hover:underline"
              onClick={openProjectConfig}
            >
              Edit in project.json
            </button>
          </p>
        )}
      </>
    )
  );
}
