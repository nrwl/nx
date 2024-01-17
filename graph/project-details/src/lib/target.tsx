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
import { Fence } from '@nx/shared-ui-fence';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FadingCollapsible } from './ui/fading-collapsible.component';

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

  useEffect(() => {
    const expandedSections = searchParams.get('expanded')?.split(',') || [];
    setCollapsed(!expandedSections.includes(targetName));
  }, [searchParams, targetName]);

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
        className={`flex space-between group hover:bg-slate-200 dark:hover:bg-slate-800 p-2 cursor-pointer items-center ${
          !collapsed
            ? 'bg-slate-200 dark:bg-slate-800 border-b-2 border-slate-900/10 dark:border-slate-300/10 '
            : ''
        }`}
        onClick={toggleCollapsed}
      >
        <h3 className="font-bold mr-2">{targetName}</h3>
        <p className="text-slate-600 mr-2">
          {targetConfiguration?.command ??
            targetConfiguration.options?.command ??
            targetConfiguration.executor}
        </p>
        {targetConfiguration.cache && (
          <span className="rounded-full inline-block text-xs bg-sky-500 px-2 text-slate-50">
            Cacheable
          </span>
        )}
        <span className="flex items-center ml-auto">
          <EyeIcon
            className="h-4 w-4 mr-2 hidden group-hover:inline-block"
            title="View in Task Graph"
            onClick={viewInTaskGraph}
          ></EyeIcon>
          {environment === 'nx-console' && (
            <PlayIcon className="h-5 w-5" onClick={runTarget} />
          )}
          {collapsed ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronUpIcon className="h-3 w-3" />
          )}
        </span>
      </header>
      {/* body */}
      {!collapsed && (
        <div className="p-4 text-base">
          {targetConfiguration.inputs && (
            <>
              <h4 className="font-bold">Inputs</h4>
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.inputs.map((input) => (
                  <li> {input.toString()} </li>
                ))}
              </ul>
            </>
          )}
          {targetConfiguration.outputs && (
            <>
              <h4 className="font-bold">Outputs</h4>
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.outputs?.map((output) => (
                  <li> {output.toString()} </li>
                )) ?? <span>no outputs</span>}
              </ul>
            </>
          )}
          {targetConfiguration.dependsOn && (
            <>
              <h4 className="font-bold">Depends On</h4>
              <ul className="list-disc pl-5 mb-4">
                {targetConfiguration.dependsOn.map((dep) => (
                  <li> {dep.toString()} </li>
                ))}
              </ul>
            </>
          )}
          {shouldRenderOptions ? (
            <>
              <h4 className="font-bold mb-2">Options</h4>
              <div className="mb-4">
                <FadingCollapsible>
                  <Fence
                    language="json"
                    command=""
                    path=""
                    fileName=""
                    highlightLines={[]}
                    lineGroups={{}}
                    enableCopy={true}
                  >
                    {JSON.stringify(targetConfiguration.options, null, 2)}
                  </Fence>
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
                <Fence
                  language="json"
                  command=""
                  path=""
                  fileName=""
                  highlightLines={[]}
                  lineGroups={{}}
                  enableCopy={true}
                >
                  {JSON.stringify(targetConfiguration.configurations, null, 2)}
                </Fence>
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
