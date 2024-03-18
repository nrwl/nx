/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

// nx-ignore-next-line
import { TargetConfiguration } from '@nx/devkit';
import { JsonCodeBlock } from '@nx/graph/ui-code-block';
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { SourceInfo } from './source-info';
import { FadingCollapsible } from './fading-collapsible';
import { TargetConfigurationProperty } from './target-configuration-property';
import { selectSourceInfo } from './target-configuration-details.util';
import { CopyToClipboard } from './copy-to-clipboard';
import {
  ExternalLink,
  PropertyInfoTooltip,
  Tooltip,
} from '@nx/graph/ui-tooltips';
import { TooltipTriggerText } from './tooltip-trigger-text';
import { twMerge } from 'tailwind-merge';
import { Pill } from '../pill';

/* eslint-disable-next-line */
export interface TargetProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
  variant?: 'default' | 'compact';
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
      onExpand,
      onCollapse,
      onViewInTaskGraph,
      onRunTarget,
    }: TargetProps,
    ref: ForwardedRef<TargetConfigurationDetailsHandle>
  ) => {
    const isCompact = variant === 'compact';
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

    const configurations = targetConfiguration.configurations;

    const shouldRenderOptions =
      options &&
      (typeof options === 'object' ? Object.keys(options).length : true);

    const shouldRenderConfigurations =
      configurations &&
      (typeof configurations === 'object'
        ? Object.keys(configurations).length
        : true);

    return (
      <div className="relative overflow-hidden rounded-md border border-slate-200 dark:border-slate-700/60">
        <header
          className={twMerge(
            `group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60`,
            isCompact ? 'px-2 py-1' : 'p-2',
            !collapsed
              ? 'border-b bg-slate-50 dark:border-slate-700/60 dark:border-slate-300/10 dark:bg-slate-800/60 '
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
                  <p className="text-sm text-slate-400">
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
                  className="rounded-md bg-inherit p-1 text-sm text-slate-600 ring-1 ring-inset ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60"
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
                  className="rounded-md bg-inherit p-1 text-sm text-slate-600 ring-1 ring-inset ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60"
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
            <div className="mt-2 ml-5 flex items-center text-sm">
              <span className="flex min-w-0 flex-1 items-center">
                <SourceInfo
                  data={sourceMap[`targets.${targetName}`]}
                  propertyKey={`targets.${targetName}`}
                  color="text-gray-500 dark:text-slate-400"
                />
              </span>
              {targetName !== 'nx-release-publish' && (
                <div className="flex items-center gap-2">
                  <code className="ml-4 rounded bg-gray-100 px-2 py-1 font-mono text-gray-800 dark:bg-gray-700 dark:text-gray-300">
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
            <div className="group mb-4">
              <h4 className="mb-4">
                {singleCommand ? (
                  <span className="font-medium">
                    Command
                    <span className="ml-2 mb-1 hidden group-hover:inline">
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

            {targetConfiguration.inputs && (
              <div className="group">
                <h4 className="mb-4">
                  <Tooltip
                    openAction="hover"
                    content={(<PropertyInfoTooltip type="inputs" />) as any}
                  >
                    <span className="font-medium">
                      <TooltipTriggerText>Inputs</TooltipTriggerText>
                    </span>
                  </Tooltip>
                  <span className="ml-2 mb-1 hidden group-hover:inline">
                    <CopyToClipboard
                      onCopy={() =>
                        handleCopyClick(
                          `"inputs": ${JSON.stringify(
                            targetConfiguration.inputs
                          )}`
                        )
                      }
                    />
                  </span>
                </h4>
                <ul className="mb-4 list-disc pl-5">
                  {targetConfiguration.inputs.map((input, idx) => {
                    const sourceInfo = selectSourceInfo(
                      sourceMap,
                      `targets.${targetName}.inputs`
                    );
                    return (
                      <li
                        className="group/line overflow-hidden whitespace-nowrap"
                        key={`input-${idx}`}
                      >
                        <TargetConfigurationProperty data={input}>
                          {sourceInfo && (
                            <span className="shrink-1 inline flex min-w-0 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
                              <SourceInfo
                                data={sourceInfo}
                                propertyKey={`targets.${targetName}.inputs`}
                              />
                            </span>
                          )}
                        </TargetConfigurationProperty>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {targetConfiguration.outputs && (
              <div className="group">
                <h4 className="mb-4">
                  <Tooltip
                    openAction="hover"
                    content={(<PropertyInfoTooltip type="outputs" />) as any}
                  >
                    <span className="font-medium">
                      <TooltipTriggerText>Outputs</TooltipTriggerText>
                    </span>
                  </Tooltip>
                  <span className="ml-2 mb-1 hidden group-hover:inline">
                    <CopyToClipboard
                      onCopy={() =>
                        handleCopyClick(
                          `"outputs": ${JSON.stringify(
                            targetConfiguration.outputs
                          )}`
                        )
                      }
                    />
                  </span>
                </h4>
                <ul className="mb-4 list-disc pl-5">
                  {targetConfiguration.outputs?.map((output, idx) => {
                    const sourceInfo = selectSourceInfo(
                      sourceMap,
                      `targets.${targetName}.outputs`
                    );
                    return (
                      <li
                        className="group/line overflow-hidden whitespace-nowrap"
                        key={`output-${idx}`}
                      >
                        <TargetConfigurationProperty data={output}>
                          {sourceInfo && (
                            <span className="shrink-1 inline flex min-w-0 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
                              <SourceInfo
                                data={sourceInfo}
                                propertyKey={`targets.${targetName}.outputs`}
                              />
                            </span>
                          )}
                        </TargetConfigurationProperty>
                      </li>
                    );
                  }) ?? <span>no outputs</span>}
                </ul>
              </div>
            )}
            {targetConfiguration.dependsOn && (
              <div className="group">
                <h4 className="mb-4">
                  <Tooltip
                    openAction="hover"
                    content={(<PropertyInfoTooltip type="dependsOn" />) as any}
                  >
                    <span className="font-medium">
                      <TooltipTriggerText>Depends On</TooltipTriggerText>
                    </span>
                  </Tooltip>
                  <span className="inline pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
                    <CopyToClipboard
                      onCopy={() =>
                        handleCopyClick(
                          `"dependsOn": ${JSON.stringify(
                            targetConfiguration.dependsOn
                          )}`
                        )
                      }
                    />
                  </span>
                </h4>
                <ul className="mb-4 list-disc pl-5">
                  {targetConfiguration.dependsOn.map((dep, idx) => {
                    const sourceInfo = selectSourceInfo(
                      sourceMap,
                      `targets.${targetName}.dependsOn`
                    );

                    return (
                      <li
                        className="group/line overflow-hidden whitespace-nowrap"
                        key={`dependsOn-${idx}`}
                      >
                        <TargetConfigurationProperty data={dep}>
                          <span className="shrink-1 inline flex min-w-0 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
                            {sourceInfo && (
                              <SourceInfo
                                data={sourceInfo}
                                propertyKey={`targets.${targetName}.dependsOn`}
                              />
                            )}
                          </span>
                        </TargetConfigurationProperty>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {shouldRenderOptions ? (
              <>
                <h4 className="mb-4">
                  <Tooltip
                    openAction="hover"
                    content={(<PropertyInfoTooltip type="options" />) as any}
                  >
                    <span className="font-medium">
                      <TooltipTriggerText>Options</TooltipTriggerText>
                    </span>
                  </Tooltip>
                </h4>
                <div className="mb-4">
                  <FadingCollapsible>
                    <JsonCodeBlock
                      data={options}
                      renderSource={(propertyName: string) => {
                        const sourceInfo = selectSourceInfo(
                          sourceMap,
                          `targets.${targetName}.options.${propertyName}`
                        );
                        return sourceInfo ? (
                          <span className="shrink-1 flex min-w-0 pl-4">
                            <SourceInfo
                              data={sourceInfo}
                              propertyKey={`targets.${targetName}.options.${propertyName}`}
                            />
                          </span>
                        ) : null;
                      }}
                    />
                  </FadingCollapsible>
                </div>
              </>
            ) : (
              ''
            )}

            {shouldRenderConfigurations ? (
              <>
                <h4 className="mb-4 py-2">
                  <Tooltip
                    openAction="hover"
                    content={
                      (<PropertyInfoTooltip type="configurations" />) as any
                    }
                  >
                    <span className="font-medium">
                      <TooltipTriggerText>Configurations</TooltipTriggerText>
                    </span>
                  </Tooltip>{' '}
                  {targetConfiguration.defaultConfiguration && (
                    <span className="ml-3 cursor-help">
                      <Pill
                        tooltip="Default Configuration"
                        text={targetConfiguration.defaultConfiguration}
                        color="yellow"
                      />
                    </span>
                  )}
                </h4>
                <FadingCollapsible>
                  <JsonCodeBlock
                    data={targetConfiguration.configurations}
                    renderSource={(propertyName: string) => {
                      const sourceInfo = selectSourceInfo(
                        sourceMap,
                        `targets.${targetName}.configurations.${propertyName}`
                      );
                      return sourceInfo ? (
                        <span className="shrink-1 flex min-w-0 pl-4">
                          <SourceInfo
                            data={sourceInfo}
                            propertyKey={`targets.${targetName}.configurations.${propertyName}`}
                          />{' '}
                        </span>
                      ) : null;
                    }}
                  />
                </FadingCollapsible>
              </>
            ) : (
              ''
            )}
          </div>
        )}
      </div>
    );
  }
);

export default TargetConfigurationDetails;
