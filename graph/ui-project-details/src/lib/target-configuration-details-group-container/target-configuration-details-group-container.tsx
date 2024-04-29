import { forwardRef } from 'react';
import { TargetConfigurationGroupHeader } from '../target-configuration-details-group-header/target-configuration-details-group-header';

export interface TargetConfigurationGroupContainerProps {
  targetGroupName: string;
  targetsNumber: number;
  children: React.ReactNode;
}

export const TargetConfigurationGroupContainer = forwardRef(
  (
    {
      targetGroupName,
      targetsNumber,
      children,
    }: TargetConfigurationGroupContainerProps,
    ref: React.Ref<any>
  ) => {
    return (
      <div>
        <div ref={ref} className="mb-4 w-full">
          <TargetConfigurationGroupHeader
            targetGroupName={targetGroupName}
            targetsNumber={targetsNumber}
          />
          <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
            {children}
          </div>
        </div>
      </div>
    );
  }
);
