// eslint-disable-next-line @typescript-eslint/no-unused-vars

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';

import { EyeIcon } from '@heroicons/react/24/outline';
import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import {
  TargetConfigurationDetails,
  TargetConfigurationDetailsHandle,
} from '../target-configuration-details/target-configuration-details';
import { TooltipTriggerText } from '../target-configuration-details/tooltip-trigger-text';
import {
  createRef,
  ForwardedRef,
  forwardRef,
  RefObject,
  useImperativeHandle,
  useRef,
} from 'react';
import { twMerge } from 'tailwind-merge';
import { Pill } from '../pill';

export interface ProjectDetailsProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  variant?: 'default' | 'compact';
  onTargetCollapse?: (targetName: string) => void;
  onTargetExpand?: (targetName: string) => void;
  onViewInProjectGraph?: (data: { projectName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
}

export interface ProjectDetailsImperativeHandle {
  collapseTarget: (targetName: string) => void;
  expandTarget: (targetName: string) => void;
}

export const ProjectDetails = forwardRef(
  (
    {
      project: {
        name,
        data: { root, ...projectData },
      },
      sourceMap,
      variant,
      onTargetCollapse,
      onTargetExpand,
      onViewInProjectGraph,
      onViewInTaskGraph,
      onRunTarget,
    }: ProjectDetailsProps,
    ref: ForwardedRef<ProjectDetailsImperativeHandle>
  ) => {
    const isCompact = variant === 'compact';
    const projectTargets = Object.keys(projectData.targets ?? {});
    const targetRefs = useRef(
      projectTargets.reduce((acc, targetName) => {
        acc[targetName] = createRef<TargetConfigurationDetailsHandle>();
        return acc;
      }, {} as Record<string, RefObject<TargetConfigurationDetailsHandle>>)
    );

    const displayType =
      projectData.projectType &&
      projectData.projectType?.charAt(0)?.toUpperCase() +
        projectData.projectType?.slice(1);

    useImperativeHandle(ref, () => ({
      collapseTarget: (targetName: string) => {
        targetRefs.current[targetName]?.current?.collapse();
      },
      expandTarget: (targetName: string) => {
        targetRefs.current[targetName]?.current?.expand();
      },
    }));

    return (
      <>
        <header
          className={twMerge(
            `border-b border-slate-900/10 dark:border-slate-300/10`,
            isCompact ? 'mb-2' : 'mb-4'
          )}
        >
          <h1
            className={twMerge(
              `flex items-center justify-between dark:text-slate-100`,
              isCompact ? `text-2xl gap-1` : `text-4xl mb-4 gap-2`
            )}
          >
            <span>{name}</span>
            <span>
              {onViewInProjectGraph ? (
                <button
                  className="text-base cursor-pointer items-center inline-flex gap-2 text-slate-600 dark:text-slate-300 ring-2 ring-inset ring-slate-400/40 dark:ring-slate-400/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-md py-1 px-2"
                  onClick={() => onViewInProjectGraph({ projectName: name })}
                >
                  <EyeIcon className="h-5 w-5 "></EyeIcon>
                  <span>View In Graph</span>
                </button>
              ) : null}{' '}
            </span>
          </h1>
          <div className="py-2 ">
            {projectData.tags && projectData.tags.length ? (
              <p>
                <span className="font-medium inline-block w-10">Tags:</span>
                {projectData.tags?.map((tag) => (
                  <span className="ml-2 font-mono">
                    <Pill text={tag} />
                  </span>
                ))}
              </p>
            ) : null}
            <p>
              <span className="font-medium inline-block w-10">Root:</span>
              <span className="font-mono"> {root}</span>
            </p>
            {displayType ? (
              <p>
                <span className="font-medium inline-block w-10">Type:</span>
                <span className="font-mono"> {displayType}</span>
              </p>
            ) : null}
          </div>
        </header>
        <div>
          <h2 className={isCompact ? `text-lg mb-3` : `text-xl mb-4`}>
            <Tooltip
              openAction="hover"
              content={(<PropertyInfoTooltip type="targets" />) as any}
            >
              <span className="text-slate-800 dark:text-slate-200">
                <TooltipTriggerText>Targets</TooltipTriggerText>
              </span>
            </Tooltip>
          </h2>
          <ul>
            {projectTargets.sort(sortNxReleasePublishLast).map((targetName) => {
              const target = projectData.targets?.[targetName];
              return target && targetRefs.current[targetName] ? (
                <li className="mb-4 last:mb-0" key={`target-${targetName}`}>
                  <TargetConfigurationDetails
                    ref={targetRefs.current[targetName]}
                    variant={variant}
                    projectName={name}
                    targetName={targetName}
                    targetConfiguration={target}
                    sourceMap={sourceMap}
                    onRunTarget={onRunTarget}
                    onViewInTaskGraph={onViewInTaskGraph}
                    onCollapse={onTargetCollapse}
                    onExpand={onTargetExpand}
                  />
                </li>
              ) : null;
            })}
          </ul>
        </div>
      </>
    );
  }
);

function sortNxReleasePublishLast(a: string, b: string) {
  if (a === 'nx-release-publish') return 1;
  if (b === 'nx-release-publish') return -1;
  return 1;
}

export default ProjectDetails;
