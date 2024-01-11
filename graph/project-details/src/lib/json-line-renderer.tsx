import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { getSourceInformation } from './get-source-information';
import useMapState from './use-map-state';
import {
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import { useNavigate } from 'react-router-dom';
import { get } from 'http';
import { useEffect } from 'react';

interface JsonLineRendererProps {
  jsonData: any;
  sourceMap: Record<string, string[]>;
}

export function JsonLineRenderer(props: JsonLineRendererProps) {
  let collapsibleSections = new Map<number, number>();
  let lines: [string, number][] = [];
  let currentLine = 0;
  let lineToPropertyPathMap = new Map<number, string>();
  let lineToInteractionMap = new Map<
    number,
    { target: string; configuration?: string }
  >();

  const [getCollapsed, setCollapsed] = useMapState<number, boolean>();
  const { environment } = useEnvironmentConfig();
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
  const routeContructor = useRouteConstructor();

  function add(value: string, depth: number) {
    if (lines.length === currentLine) {
      lines.push(['', depth]);
    }
    lines[currentLine] = [lines[currentLine][0] + value, depth];
  }

  function processJson(
    jsonData: any,
    depth = 0,
    propertyPath = '',
    isLast = false
  ) {
    if (Array.isArray(jsonData)) {
      const sectionStart = currentLine;
      add('[', depth);
      currentLine++;

      jsonData.forEach((value, index) => {
        const newPropertyPath = `${
          propertyPath ? propertyPath + '.' : ''
        }${value}`;
        lineToPropertyPathMap.set(currentLine, newPropertyPath);

        processJson(
          value,
          depth + 1,
          newPropertyPath,
          index === jsonData.length - 1
        );
      });

      add(']', depth);
      if (!isLast) {
        add(',', depth);
      }
      const sectionEnd = currentLine;
      collapsibleSections.set(sectionStart, sectionEnd);
      currentLine++;
    } else if (jsonData && typeof jsonData === 'object') {
      const sectionStart = currentLine;
      add('{', depth);
      currentLine++;

      Object.entries(jsonData).forEach(([key, value], index, array) => {
        // skip empty objects
        if (
          Object.keys(value as any).length === 0 &&
          typeof value === 'object'
        ) {
          return;
        }

        // skip certain root properties
        if (
          depth === 0 &&
          (key === 'sourceRoot' ||
            key === 'name' ||
            key === '$schema' ||
            key === 'tags')
        ) {
          return;
        }

        add(`"${key}": `, depth);

        if (propertyPath === 'targets') {
          lineToInteractionMap.set(currentLine, { target: key });
        }
        if (propertyPath.match(/^targets\..*configurations$/)) {
          lineToInteractionMap.set(currentLine, {
            target: propertyPath.split('.')[1],
            configuration: key,
          });
        }

        const newPropertyPath = `${
          propertyPath ? propertyPath + '.' : ''
        }${key}`;
        lineToPropertyPathMap.set(currentLine, newPropertyPath);

        processJson(
          value,
          depth + 1,
          newPropertyPath,
          index === array.length - 1
        );
      });

      add('}', depth);
      if (!isLast) {
        add(',', depth);
      }
      const sectionEnd = currentLine;
      collapsibleSections.set(sectionStart, sectionEnd);
      currentLine++;
    } else {
      add(`"${jsonData}"`, depth);
      if (!isLast) {
        add(',', depth);
      }
      currentLine++;
    }
  }

  processJson(props.jsonData);

  console.log(lineToInteractionMap);
  // start off with all targets & configurations collapsed~
  useEffect(() => {
    for (const line of lineToInteractionMap.keys()) {
      if (!getCollapsed(line)) {
        setCollapsed(line, true);
      }
    }
  }, []);

  function toggleCollapsed(index: number) {
    setCollapsed(index, !getCollapsed(index));
  }

  function lineIsCollapsed(index: number) {
    for (const [start, end] of collapsibleSections) {
      if (index > start && index < end) {
        if (getCollapsed(start)) {
          return true;
        }
      }
    }
    return false;
  }

  function runTarget({
    target,
    configuration,
  }: {
    target: string;
    configuration?: string;
  }) {
    const projectName = props.jsonData.name;

    externalApiService.postEvent({
      type: 'run-task',
      payload: { taskId: `${projectName}:${target}` },
    });
  }

  function viewInTaskGraph({
    target,
    configuration,
  }: {
    target: string;
    configuration?: string;
  }) {
    const projectName = props.jsonData.name;
    if (environment === 'nx-console') {
      externalApiService.postEvent({
        type: 'open-task-graph',
        payload: {
          projectName: projectName,
          targetName: target,
        },
      });
    } else {
      navigate(
        routeContructor(
          {
            pathname: `/tasks/${encodeURIComponent(target)}`,
            search: `?projects=${encodeURIComponent(projectName)}`,
          },
          true
        )
      );
    }
  }

  return (
    <div className="overflow-auto w-full h-full flex">
      <div className="h-fit min-h-full w-12 shrink-0 pr-2 border-solid border-r-2 border-slate-700">
        {lines.map(([text, indentation], index) => {
          if (
            lineIsCollapsed(index) ||
            index === 0 ||
            index === lines.length - 1
          ) {
            return null;
          }
          const canCollapse =
            collapsibleSections.has(index) &&
            collapsibleSections.get(index)! - index > 1;
          const interaction = lineToInteractionMap.get(index);
          return (
            <div className="flex justify-end items-center h-6">
              {interaction?.target && !interaction?.configuration && (
                <EyeIcon
                  className="h-4 w-4"
                  onClick={() => viewInTaskGraph(interaction!)}
                />
              )}
              {environment === 'nx-console' && interaction?.target && (
                <PlayIcon
                  className="h-4 w-4"
                  onClick={() => runTarget(interaction!)}
                />
              )}

              {canCollapse && (
                <div onClick={() => toggleCollapsed(index)} className="h-4 w-4">
                  {getCollapsed(index) ? (
                    <ChevronRightIcon />
                  ) : (
                    <ChevronDownIcon />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="pl-2">
        {lines.map(([text, indentation], index) => {
          if (
            lineIsCollapsed(index) ||
            index === 0 ||
            index === lines.length - 1
          ) {
            return null;
          }
          const propertyPathAtLine = lineToPropertyPathMap.get(index);
          const sourceInformation = propertyPathAtLine
            ? getSourceInformation(props.sourceMap, propertyPathAtLine)
            : '';
          return (
            <pre
              style={{ paddingLeft: `${indentation}rem` }}
              className="group truncate hover:bg-slate-800 h-6"
            >
              {text}
              {getCollapsed(index) ? '...' : ''}

              <span className="ml-16 hidden group-hover:inline-block text-sm text-slate-500">
                {sourceInformation}
              </span>
            </pre>
          );
        })}
      </div>
    </div>
  );
}
