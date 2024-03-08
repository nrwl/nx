import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';
// nx-ignore-next-line
import type { ExpandedInputs } from 'nx/src/command-line/graph/inputs-utils';
/* eslint-enable @nx/enforce-module-boundaries */
import { Pill } from '@nx/graph/ui-components';
import {
  ExternalLink,
  PropertyInfoTooltip,
  Tooltip,
} from '@nx/graph/ui-tooltips';

import { SourceInfo } from './source-info';
import { CopyToClipboard } from './copy-to-clipboard';
import { TooltipTriggerText } from './tooltip-trigger-text';
import { twMerge } from 'tailwind-merge';
import { TargetConfigurationDetailsInputs } from './target-configuration-details-inputs';
import { TargetConfigurationDetailsOutputs } from './target-configuration-details-outputs';
import { TargetConfigurationDetailsDependsOn } from './target-configuration-details-depends-on';
import { TargetConfigurationDetailsOptions } from './target-configuration-details-options';
import { TargetConfigurationDetailsConfiguration } from './target-configuration-details-configuration';

export interface TargetProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
  variant?: 'default' | 'compact';
  getInputs?: (
    taskId: string
  ) => Promise<{ [inputName: string]: ExpandedInputs } | undefined>;
  onCollapse?: (targetName: string) => void;
  onExpand?: (targetName: string) => void;
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
}

export interface TargetConfigurationDetailsHandle {
  collapse: () => void;
  expand: () => void;
}

export const TargetConfigurationDetails = forwardRef(
  (
    {
      variant,
      projectName,
      targetName,
      targetConfiguration,
      sourceMap,
      getInputs,
      onExpand,
      onCollapse,
      onViewInTaskGraph,
      onRunTarget,
    }: TargetProps,
    ref: ForwardedRef<TargetConfigurationDetailsHandle>
  ) => {
    const isCompact = variant === 'compact';
    const taskId = `${projectName}:${targetName}${
      targetConfiguration.defaultConfiguration
        ? ':' + targetConfiguration.defaultConfiguration
        : ''
    }`;
    const [collapsed, setCollapsed] = useState(true);

    const handleCopyClick = async (copyText: string) => {
      await window.navigator.clipboard.writeText(copyText);
    };

    const handleCollapseToggle = useCallback(
      () => setCollapsed((collapsed) => !collapsed),
      [setCollapsed]
    );

    useEffect(() => {
      if (collapsed) {
        onCollapse?.(targetName);
      } else {
        onExpand?.(targetName);
      }
    }, [collapsed, onCollapse, onExpand, projectName, targetName]);

    useImperativeHandle(ref, () => ({
      collapse: () => {
        !collapsed && setCollapsed(true);
      },
      expand: () => {
        collapsed && setCollapsed(false);
      },
    }));

    let executorLink: string | null = null;

    // TODO: Handle this better because this will not work with labs
    if (targetConfiguration.executor?.startsWith('@nx/')) {
      const packageName = targetConfiguration.executor
        .split('/')[1]
        .split(':')[0];
      const executorName = targetConfiguration.executor
        .split('/')[1]
        .split(':')[1];
      executorLink = `https://nx.dev/nx-api/${packageName}/executors/${executorName}`;
    } else if (targetConfiguration.executor === 'nx:run-commands') {
      executorLink = `https://nx.dev/nx-api/nx/executors/run-commands`;
    } else if (targetConfiguration.executor === 'nx:run-script') {
      executorLink = `https://nx.dev/nx-api/nx/executors/run-script`;
    }

    const singleCommand =
      targetConfiguration.executor === 'nx:run-commands'
        ? targetConfiguration.command ?? targetConfiguration.options?.command
        : null;
    const options = useMemo(() => {
      if (singleCommand) {
        const { command, ...rest } = targetConfiguration.options;
        return rest;
      } else {
        return targetConfiguration.options;
      }
    }, [targetConfiguration.options, singleCommand]);

    return (
      <div className="rounded-md border border-slate-200 dark:border-slate-700/60 relative overflow-hidden">
        <header
          className={twMerge(
            `group hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer`,
            isCompact ? 'px-2 py-1' : 'p-2',
            !collapsed
              ? 'bg-slate-50 dark:bg-slate-800/60 border-b dark:border-slate-700/60 dark:border-slate-300/10 '
              : ''
          )}
          onClick={handleCollapseToggle}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {collapsed ? (
                <ChevronDownIcon className="h-3 w-3" />
              ) : (
                <ChevronUpIcon className="h-3 w-3" />
              )}
              <h3 className="font-medium dark:text-slate-300">{targetName}</h3>
              {collapsed &&
                targetConfiguration?.executor !== '@nx/js:release-publish' && (
                  <p className="text-slate-400 text-sm">
                    {singleCommand
                      ? singleCommand
                      : targetConfiguration.executor}
                  </p>
                )}
              {targetName === 'nx-release-publish' && (
                <Tooltip
                  openAction="hover"
                  strategy="fixed"
                  content={(<PropertyInfoTooltip type="release" />) as any}
                >
                  <span className="inline-flex">
                    <Pill text="nx release" color="grey" />
                  </span>
                </Tooltip>
              )}
              {targetConfiguration.cache && (
                <Tooltip
                  openAction="hover"
                  strategy="fixed"
                  content={(<PropertyInfoTooltip type="cacheable" />) as any}
                >
                  <span className="inline-flex">
                    <Pill text="Cacheable" color="green" />
                  </span>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onViewInTaskGraph && (
                <button
                  className="text-slate-600 dark:text-slate-300 text-sm ring-1 ring-inset ring-slate-400/40 dark:ring-slate-400/30 hover:bg-slate-200 dark:hover:bg-slate-700/60 p-1 bg-inherit rounded-md"
                  // TODO: fix tooltip overflow in collapsed state
                  data-tooltip={collapsed ? false : 'View in Task Graph'}
                  data-tooltip-align-right
                >
                  <EyeIcon
                    className={`h-5 w-5 !cursor-pointer`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewInTaskGraph({ projectName, targetName });
                    }}
                  />
                </button>
              )}

              {onRunTarget && (
                <span
                  className="text-slate-600 dark:text-slate-300 text-sm ring-1 ring-inset ring-slate-400/40 dark:ring-slate-400/30 hover:bg-slate-200 dark:hover:bg-slate-700/60 p-1 bg-inherit rounded-md"
                  // TODO: fix tooltip overflow in collapsed state
                  data-tooltip={collapsed ? false : 'Run Target'}
                  data-tooltip-align-right
                >
                  <PlayIcon
                    className="h-5 w-5 !cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunTarget({ projectName, targetName });
                    }}
                  />
                </span>
              )}
            </div>
          </div>
          {!collapsed && (
            <div className="flex items-center text-sm mt-2 ml-5">
              <span className="flex-1 flex min-w-0 items-center">
                <SourceInfo
                  data={sourceMap[`targets.${targetName}`]}
                  propertyKey={`targets.${targetName}`}
                  color="text-gray-500 dark:text-slate-400"
                />
              </span>
              {targetName !== 'nx-release-publish' && (
                <div className="flex items-center gap-2">
                  <code className="ml-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 font-mono px-2 py-1 rounded">
                    nx run {projectName}:{targetName}
                  </code>
                  <span>
                    <CopyToClipboard
                      onCopy={() =>
                        handleCopyClick(`nx run ${projectName}:${targetName}`)
                      }
                      tooltipAlignment="right"
                    />
                  </span>
                </div>
              )}
            </div>
          )}
        </header>
        {/* body */}
        {!collapsed && (
          <div className="p-4 text-base">
            <div className="mb-4 group">
              <h4 className="mb-4">
                {singleCommand ? (
                  <span className="font-medium">
                    Command
                    <span className="hidden group-hover:inline ml-2 mb-1">
                      <CopyToClipboard
                        onCopy={() =>
                          handleCopyClick(`"command": "${singleCommand}"`)
                        }
                      />
                    </span>
                  </span>
                ) : (
                  <Tooltip
                    openAction="hover"
                    content={(<PropertyInfoTooltip type="executors" />) as any}
                  >
                    <span className="font-medium">
                      <TooltipTriggerText>Executor</TooltipTriggerText>
                    </span>
                  </Tooltip>
                )}
              </h4>
              <p className="pl-5 font-mono">
                {executorLink ? (
                  <span>
                    <ExternalLink
                      href={executorLink ?? 'https://nx.dev/nx-api'}
                      text={
                        singleCommand
                          ? singleCommand
                          : targetConfiguration.executor
                      }
                    />
                  </span>
                ) : singleCommand ? (
                  singleCommand
                ) : (
                  targetConfiguration.executor
                )}
              </p>
            </div>

            <TargetConfigurationDetailsInputs
              inputs={targetConfiguration.inputs}
              sourceMap={sourceMap}
              projectName={projectName}
              targetName={targetName}
              handleCopyClick={handleCopyClick}
              getInputs={getInputs}
              taskId={taskId}
            />
            <TargetConfigurationDetailsOutputs
              outputs={targetConfiguration.outputs}
              sourceMap={sourceMap}
              targetName={targetName}
              handleCopyClick={handleCopyClick}
            />
            <TargetConfigurationDetailsDependsOn
              dependsOn={targetConfiguration.dependsOn}
              sourceMap={sourceMap}
              targetName={targetName}
              handleCopyClick={handleCopyClick}
            />
            <TargetConfigurationDetailsOptions
              options={options}
              sourceMap={sourceMap}
              targetName={targetName}
              handleCopyClick={handleCopyClick}
            />
            <TargetConfigurationDetailsConfiguration
              defaultConfiguration={targetConfiguration.defaultConfiguration}
              configurations={targetConfiguration.configurations}
              sourceMap={sourceMap}
              targetName={targetName}
            />
          </div>
        )}
      </div>
    );
  }
);

export default TargetConfigurationDetails;
