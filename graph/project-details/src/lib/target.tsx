/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
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
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SourceItem } from './ui/sourcemap-info-component';
import { FadingCollapsible } from './ui/fading-collapsible.component';
import { RenderProperty } from './ui/render-property.component';
import { selectSourceInfo } from './select-source-info';

/* eslint-disable-next-line */
export interface TargetProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
}

export function Target({
  projectName,
  targetName,
  targetConfiguration,
  sourceMap,
}: TargetProps) {
  const environment = useEnvironmentConfig()?.environment;
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
  const routeContructor = useRouteConstructor();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const expandedSections = searchParams.get('expanded')?.split(',') || [];
    setCollapsed(!expandedSections.includes(targetName));
  }, [searchParams, targetName]);

  const handleCopyClick = (copyText: string) => {
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 600);
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
        routeContructor(
          {
            pathname: `/tasks/${encodeURIComponent(targetName)}`,
            search: `?projects=${encodeURIComponent(projectName)}`,
          },
          true
        )
      );
    }
  };

  const shouldRenderOptions =
    targetConfiguration.options &&
    (typeof targetConfiguration.options === 'object'
      ? Object.keys(targetConfiguration.options).length
      : true);

  const shouldRenderConfigurations =
    targetConfiguration.configurations &&
    (typeof targetConfiguration.configurations === 'object'
      ? Object.keys(targetConfiguration.configurations).length
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
                {targetConfiguration?.command ??
                  targetConfiguration.options?.command ??
                  targetConfiguration.executor}
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
              <span className="rounded-full inline-block text-xs bg-sky-500 px-2 text-slate-50 mr-2">
                Cacheable
              </span>
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
          <div className="text-gray-600 text-sm mt-2">
            <span>
              Created by {sourceMap[`targets.${targetName}`]?.[1]} from{' '}
              {sourceMap[`targets.${targetName}`]?.[0]}
            </span>
            <code className="ml-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 font-mono px-2 py-1 rounded">
              nx run {projectName}:{targetName}
            </code>
            <ClipboardIcon
              className={`h-5 w-5 ml-2 inline-block cursor-pointer ${
                copied ? 'text-sky-500' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleCopyClick(`nx run ${projectName}:${targetName}`);
              }}
            ></ClipboardIcon>
          </div>
        )}
      </header>
      {/* body */}
      {!collapsed && (
        <div className="p-4 text-base">
          <div className="mb-4">
            <h4 className="font-bold">Executor</h4>
            <p>
              {targetConfiguration?.command ??
                targetConfiguration.options?.command ??
                targetConfiguration.executor}
            </p>
          </div>

          {targetConfiguration.inputs && (
            <div className="group">
              <h4 className="font-bold">
                Inputs
                <ClipboardIcon
                  className={`hidden group-hover:inline h-4 w-5 ml-2 mb-1 cursor-pointer ${
                    copied ? 'text-sky-500' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyClick(JSON.stringify(targetConfiguration.inputs));
                  }}
                ></ClipboardIcon>
              </h4>
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.inputs.map((input) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.inputs`
                  );
                  return (
                    <li className="group overflow-hidden whitespace-nowrap">
                      <RenderProperty property={input}>
                        {sourceInfo && (
                          <span className="hidden group-hover:inline">
                            <SourceItem source={sourceInfo} />
                          </span>
                        )}
                      </RenderProperty>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {targetConfiguration.outputs && (
            <>
              <h4 className="font-bold">Outputs</h4>
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.outputs?.map((output) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.outputs`
                  );
                  return (
                    <li className="group overflow-hidden whitespace-nowrap">
                      <RenderProperty property={output}>
                        {sourceInfo && (
                          <span className="hidden group-hover:inline">
                            <SourceItem source={sourceInfo} />
                          </span>
                        )}
                      </RenderProperty>
                    </li>
                  );
                }) ?? <span>no outputs</span>}
              </ul>
            </>
          )}
          {targetConfiguration.dependsOn && (
            <>
              <h4 className="font-bold">Depends On</h4>
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.dependsOn.map((dep) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.dependsOn`
                  );

                  return (
                    <li className="group overflow-hidden whitespace-nowrap">
                      <RenderProperty property={dep}>
                        <span className="hidden group-hover:inline">
                          {sourceInfo && <SourceItem source={sourceInfo} />}
                        </span>
                      </RenderProperty>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {shouldRenderOptions ? (
            <>
              <h4 className="font-bold mb-2">Options</h4>
              <div className="mb-4">
                <FadingCollapsible>
                  <JsonCodeBlock
                    data={targetConfiguration.options}
                    renderSource={(propertyName: string) => {
                      const sourceInfo = selectSourceInfo(
                        sourceMap,
                        `targets.${targetName}.options.${propertyName}`
                      );
                      return sourceInfo ? (
                        <SourceItem source={sourceInfo} />
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
              <h4 className="font-bold py-2">
                Configurations{' '}
                {targetConfiguration.defaultConfiguration && (
                  <span
                    className="ml-3 rounded-full inline-block text-xs bg-sky-500 px-2 text-slate-50  mr-6"
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
                      `targets.${targetName}.options.${propertyName}`
                    );
                    return sourceInfo ? (
                      <SourceItem source={sourceInfo} />
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

export default Target;
