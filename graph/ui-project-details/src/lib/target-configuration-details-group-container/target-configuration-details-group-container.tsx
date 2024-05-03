import { TargetConfigurationGroupHeader } from '../target-configuration-details-group-header/target-configuration-details-group-header';

export interface TargetConfigurationGroupContainerProps {
  targetGroupName: string;
  targetsNumber: number;
  children: React.ReactNode;
}

export function TargetConfigurationGroupContainer({
  targetGroupName,
  targetsNumber,
  children,
}: TargetConfigurationGroupContainerProps) {
  return (
    <div className="mb-4 w-full bg-inherit">
      <TargetConfigurationGroupHeader
        targetGroupName={targetGroupName}
        targetsNumber={targetsNumber}
        className="sticky top-0 z-10 bg-inherit"
      />
      <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
        {children}
      </div>
    </div>
  );
}
