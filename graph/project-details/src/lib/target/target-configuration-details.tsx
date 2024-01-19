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
import {
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import { JsonCodeBlock } from '@nx/graph/ui-code-block';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SourceInfo } from './source-info';
import { FadingCollapsible } from './fading-collapsible';
import { TargetConfigurationProperty } from './target-configuration-property';
import { selectSourceInfo } from './target-configuration-details.util';
import { CopyToClipboard } from './copy-to-clipboard';
import {
  PropertyInfoTooltip,
  SourcemapInfoToolTip,
  Tooltip,
} from '@nx/graph/ui-tooltips';
import { TooltipTriggerText } from './ui/tooltip-trigger-text';

/* eslint-disable-next-line */
export interface TargetProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
}

export function TargetConfigurationDetails({
  projectName,
  targetName,
  targetConfiguration,
  sourceMap,
}: TargetProps) {
  const environment = useEnvironmentConfig()?.environment;
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
  const routeConstructor = useRouteConstructor();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(true);

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

  useEffect(() => {
    const expandedSections = searchParams.get('expanded')?.split(',') || [];
    setCollapsed(!expandedSections.includes(targetName));
  }, [searchParams, targetName]);

  const handleCopyClick = (copyText: string) => {
    navigator.clipboard.writeText(copyText);
  };

  function toggleCollapsed() {
    setCollapsed((prevState) => {
      const newState = !prevState;
      setSearchParams((currentSearchParams) => {
        const expandedSections =
          currentSearchParams.get('expanded')?.split(',') || [];
        if (newState) {
          const newExpandedSections = expandedSections.filter(
            (section) => section !== targetName
          );
          updateSearchParams(currentSearchParams, newExpandedSections);
        } else {
          if (!expandedSections.includes(targetName)) {
            expandedSections.push(targetName);
            updateSearchParams(currentSearchParams, expandedSections);
          }
        }
        return currentSearchParams;
      });

      return newState;
    });
  }

  function updateSearchParams(params: URLSearchParams, sections: string[]) {
    if (sections.length === 0) {
      params.delete('expanded');
    } else {
      params.set('expanded', sections.join(','));
    }
  }

  const runTarget = () => {
    externalApiService.postEvent({
      type: 'run-task',
      payload: { taskId: `${projectName}:${targetName}` },
    });
  };

  const viewInTaskGraph = () => {
    if (environment === 'nx-console') {
      externalApiService.postEvent({
        type: 'open-task-graph',
        payload: {
          projectName: projectName,
          targetName: targetName,
        },
      });
    } else {
      navigate(
        routeConstructor(
          {
            pathname: `/tasks/${encodeURIComponent(targetName)}`,
            search: `?projects=${encodeURIComponent(projectName)}`,
          },
          true
        )
      );
    }
  };

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
    <div className="rounded-md border border-slate-500 relative overflow-hidden">
      <header
        className={`group hover:bg-slate-200 dark:hover:bg-slate-800 p-2 cursor-pointer ${
          !collapsed
            ? 'bg-slate-200 dark:bg-slate-800 border-b-2 border-slate-900/10 dark:border-slate-300/10 '
            : ''
        }`}
        onClick={toggleCollapsed}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h3 className="font-bold mr-2">{targetName}</h3>
            {collapsed && (
              <p className="text-slate-600 mr-2">
                {singleCommand ? singleCommand : targetConfiguration.executor}
              </p>
            )}
          </div>
          <div className="flex items-center">
            <EyeIcon
              className={`h-4 w-4 mr-2 ${
                collapsed ? 'hidden group-hover:inline-block' : 'inline-block'
              }`}
              title="View in Task Graph"
              onClick={(e) => {
                e.stopPropagation();
                viewInTaskGraph();
              }}
            />
            {targetConfiguration.cache && (
              <Tooltip
                openAction="hover"
                strategy="fixed"
                content={(<PropertyInfoTooltip type="cacheable" />) as any}
              >
                <span className="rounded-full inline-block text-xs bg-sky-500 dark:bg-sky-800 px-2 text-slate-50 mr-2">
                  Cacheable
                </span>
              </Tooltip>
            )}
            {environment === 'nx-console' && (
              <PlayIcon
                className="h-5 w-5 mr-2"
                onClick={(e) => {
                  e.stopPropagation();
                  runTarget();
                }}
              />
            )}
            {collapsed ? (
              <ChevronDownIcon className="h-3 w-3" />
            ) : (
              <ChevronUpIcon className="h-3 w-3" />
            )}
          </div>
        </div>
        {!collapsed && (
          <div className="flex items-center text-sm mt-2">
            <span className="flex-1 flex items-center">
              <SourceInfo
                data={sourceMap[`targets.${targetName}`]}
                propertyKey={`targets.${targetName}`}
              />
            </span>
            <code className="ml-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 font-mono px-2 py-1 rounded">
              nx run {projectName}:{targetName}
            </code>
            <span className="ml-2">
              <CopyToClipboard
                onCopy={() =>
                  handleCopyClick(`nx run ${projectName}:${targetName}`)
                }
              />
            </span>
          </div>
        )}
      </header>
      {/* body */}
      {!collapsed && (
        <div className="p-4 text-base">
          <div className="mb-4 group">
            <h4 className="mb-4">
              {singleCommand ? (
                <span className="font-bold">
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
                  <span className="font-bold">
                    <TooltipTriggerText>Executor</TooltipTriggerText>
                  </span>
                </Tooltip>
              )}
            </h4>
            <p className="pl-5">
              {executorLink ? (
                <a
                  className="underline"
                  href={executorLink ?? 'https://nx.dev/nx-api'}
                  target="_blank"
                  rel="noreferrer"
                >
                  {singleCommand ? singleCommand : targetConfiguration.executor}
                </a>
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
                  <span className="font-bold">
                    <TooltipTriggerText>Inputs</TooltipTriggerText>
                  </span>
                </Tooltip>
                <span className="hidden group-hover:inline ml-2 mb-1">
                  <CopyToClipboard
                    onCopy={() =>
                      handleCopyClick(
                        `"inputs": JSON.stringify(targetConfiguration.inputs)`
                      )
                    }
                  />
                </span>
              </h4>
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.inputs.map((input) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.inputs`
                  );
                  return (
                    <li className="group/line overflow-hidden whitespace-nowrap">
                      <TargetConfigurationProperty data={input}>
                        {sourceInfo && (
                          <span className="hidden group-hover/line:inline pl-4">
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
                  <span className="font-bold">
                    <TooltipTriggerText>Outputs</TooltipTriggerText>
                  </span>
                </Tooltip>
                <span className="hidden group-hover:inline ml-2 mb-1">
                  <CopyToClipboard
                    onCopy={() =>
                      handleCopyClick(
                        `"ouputs": ${JSON.stringify(
                          targetConfiguration.outputs
                        )}`
                      )
                    }
                  />
                </span>
              </h4>
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.outputs?.map((output) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.outputs`
                  );
                  return (
                    <li className="group/line overflow-hidden whitespace-nowrap">
                      <TargetConfigurationProperty data={output}>
                        {sourceInfo && (
                          <span className="hidden group-hover/line:inline pl-4">
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
                  <span className="font-bold">
                    <TooltipTriggerText>Depends On</TooltipTriggerText>
                  </span>
                </Tooltip>
                <span className="hidden group-hover:inline ml-2 mb-1">
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
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.dependsOn.map((dep) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.dependsOn`
                  );

                  return (
                    <li className="group/line overflow-hidden whitespace-nowrap">
                      <TargetConfigurationProperty data={dep}>
                        <span className="hidden group-hover/line:inline pl-4 h-6">
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
                  <span className="font-bold">
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
                        <span className="pl-4">
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
              <h4 className="py-2 mb-4">
                <Tooltip
                  openAction="hover"
                  content={
                    (<PropertyInfoTooltip type="configurations" />) as any
                  }
                >
                  <span className="font-bold">
                    <TooltipTriggerText>Configurations</TooltipTriggerText>
                  </span>
                </Tooltip>{' '}
                {targetConfiguration.defaultConfiguration && (
                  <span
                    className="ml-3 font-bold rounded-full inline-block text-xs bg-sky-500 px-2 text-slate-50  mr-6"
                    title="Default Configuration"
                  >
                    {targetConfiguration.defaultConfiguration}
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
                      <span className="pl-4">
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

export default TargetConfigurationDetails;
