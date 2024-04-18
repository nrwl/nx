/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
import { TargetConfigurationDetailsListItem } from '../target-configuration-details-list-item/target-configuration-details-list-item';
import { TargetConfigurationGroupContainer } from '../target-configuration-details-group-container/target-configuration-details-group-container';
import { RefObject, createRef, useEffect, useRef, useState } from 'react';
import { TargetConfigurationDetailsHeader } from '../target-configuration-details-header/target-configuration-details-header';
import { Transition } from '@headlessui/react';
import { Pill } from '../pill';

export interface TargetConfigurationGroupListProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  variant?: 'default' | 'compact';
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  className?: string;
  isCompact?: boolean;
}

export function TargetConfigurationGroupList({
  project,
  variant,
  sourceMap,
  onRunTarget,
  onViewInTaskGraph,
  className,
  isCompact,
}: TargetConfigurationGroupListProps) {
  const [stickyHeaderContent, setStickHeaderContent] = useState('');
  const [stickyTargetName, setStickyTargetName] = useState('');
  const targetGroupRefs = useRef(
    Object.keys(project.data.metadata?.targetGroups ?? {}).reduce(
      (acc, targetGroupName) => {
        acc[targetGroupName] = createRef();
        return acc;
      },
      {} as Record<string, RefObject<any>>
    )
  );
  const targetNameRefs = useRef(
    Object.keys(project.data.targets ?? {}).reduce((acc, targetName) => {
      acc[targetName] = createRef();
      return acc;
    }, {} as Record<string, RefObject<any>>)
  );

  useEffect(() => {
    window.addEventListener('scroll', isSticky);
    return () => {
      window.removeEventListener('scroll', isSticky);
    };
  }, []);

  const isSticky = () => {
    const scrollTop = window.scrollY + 20;
    const foundTargetGroup: string | undefined = Object.keys(
      targetGroupRefs.current
    ).find((targetGroupName) => {
      const targetGroup = targetGroupRefs.current[targetGroupName];
      if (
        targetGroup &&
        targetGroup.current &&
        scrollTop >= targetGroup.current.offsetTop &&
        scrollTop <
          targetGroup.current.offsetTop + targetGroup.current.offsetHeight
      ) {
        return true;
      }
      return false;
    });
    if (foundTargetGroup) {
      setStickHeaderContent(foundTargetGroup);
    } else {
      setStickHeaderContent('');
    }

    if (!targetNameRefs.current) return;

    const foundTargetName: string | undefined = Object.keys(
      targetNameRefs.current
    ).find((targetName) => {
      const target = targetNameRefs.current[targetName];
      if (
        target &&
        target.current &&
        scrollTop >= target.current.offsetTop &&
        scrollTop < target.current.offsetTop + target.current.offsetHeight
      ) {
        return true;
      }
      return false;
    });
    if (foundTargetName) {
      setStickyTargetName(foundTargetName);
    } else {
      setStickyTargetName('');
    }
  };

  return (
    <>
      <Transition
        show={!!stickyHeaderContent}
        enter="transition-opacity ease-linear duration-100"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-linear duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="duration-100000 fixed top-0 left-0 right-0 z-10 bg-slate-50 text-lg ease-in dark:bg-slate-800">
          <div className="mx-auto max-w-6xl flex-grow px-8 pt-2">
            <header className="border-b-2 pb-2">
              {stickyHeaderContent}{' '}
              <Pill
                text={
                  Object.values(
                    project.data.metadata?.targetGroups?.[
                      stickyHeaderContent
                    ] ?? {}
                  ).length.toString() + ' Targets'
                }
              />
            </header>
          </div>
        </div>
      </Transition>

      <ul className={className}>
        {Object.entries(project.data.metadata?.targetGroups ?? {}).map(
          ([targetGroupName, targets], index) => {
            return (
              <TargetConfigurationGroupContainer
                ref={targetGroupRefs.current[targetGroupName]}
                targetGroupName={targetGroupName}
                targetsNumber={targets.length}
              >
                {targets.map((targetName) => (
                  <TargetConfigurationDetailsListItem
                    ref={targetNameRefs.current[targetName]}
                    project={project}
                    sourceMap={sourceMap}
                    variant={variant}
                    onRunTarget={onRunTarget}
                    onViewInTaskGraph={onViewInTaskGraph}
                    targetName={targetName}
                    collapsable={true}
                  />
                ))}
              </TargetConfigurationGroupContainer>
            );
          }
        )}
        {Object.keys(project.data.targets ?? {}).map((targetName) => {
          if (
            !project.data.metadata?.targetGroups ||
            !Object.values(project.data.metadata?.targetGroups ?? {})
              .flat()
              .includes(targetName)
          ) {
            return (
              <TargetConfigurationDetailsListItem
                ref={targetNameRefs.current[targetName]}
                project={project}
                sourceMap={sourceMap}
                variant={variant}
                onRunTarget={onRunTarget}
                onViewInTaskGraph={onViewInTaskGraph}
                targetName={targetName}
                collapsable={true}
              />
            );
          }
          return null;
        })}
      </ul>
    </>
  );
}
