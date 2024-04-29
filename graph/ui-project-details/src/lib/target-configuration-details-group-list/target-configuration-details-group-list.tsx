/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
import { RefObject, createRef, useEffect, useRef, useState } from 'react';
import { Transition } from '@headlessui/react';

import { TargetConfigurationDetailsListItem } from '../target-configuration-details-list-item/target-configuration-details-list-item';
import { TargetConfigurationGroupContainer } from '../target-configuration-details-group-container/target-configuration-details-group-container';
import { TargetConfigurationGroupHeader } from '../target-configuration-details-group-header/target-configuration-details-group-header';
import { groupTargets } from '../utils/group-targets';

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
}

export function TargetConfigurationGroupList({
  project,
  variant,
  sourceMap,
  onRunTarget,
  onViewInTaskGraph,
  className = '',
}: TargetConfigurationGroupListProps) {
  const [stickyHeaderContent, setStickHeaderContent] = useState('');
  const targetsGroup = groupTargets(project);
  const targetGroupRefs = useRef(
    Object.keys(targetsGroup.groups).reduce((acc, targetGroupName) => {
      acc[targetGroupName] = createRef();
      return acc;
    }, {} as Record<string, RefObject<any>>)
  );
  const targetNameRefs = useRef(
    targetsGroup.targets.reduce((acc, targetName) => {
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
    const scrollTop = window.scrollY + 30; // 30px for the header
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
        <div className="fixed top-0 left-0 right-0 z-10 mb-8 border-b-2 border-slate-900/10 bg-slate-50 dark:border-slate-300/10 dark:bg-slate-800 dark:text-slate-300">
          <div className="mx-auto max-w-6xl px-8 pt-2">
            <TargetConfigurationGroupHeader
              targetGroupName={stickyHeaderContent}
              targetsNumber={
                project.data.metadata?.targetGroups?.[stickyHeaderContent]
                  ?.length ?? 0
              }
            />
          </div>
        </div>
      </Transition>

      {Object.entries(targetsGroup.groups).map(([targetGroupName, targets]) => {
        return (
          <TargetConfigurationGroupContainer
            ref={targetGroupRefs.current[targetGroupName]}
            targetGroupName={targetGroupName}
            targetsNumber={targets.length}
            key={targetGroupName}
          >
            <ul className={className}>
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
                  key={targetName}
                />
              ))}
            </ul>
          </TargetConfigurationGroupContainer>
        );
      })}
      <ul className={`mt-8 p-2 ${className}`}>
        {targetsGroup.targets.map((targetName) => {
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
              key={targetName}
            />
          );
        })}
      </ul>
    </>
  );
}
