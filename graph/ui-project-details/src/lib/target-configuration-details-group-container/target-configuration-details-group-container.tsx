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
  if (targetsNumber === 0) {
    return null;
  }
  return (
    <div className="mb-4 w-full">
      <TargetConfigurationGroupHeader
        targetGroupName={targetGroupName}
        targetsNumber={targetsNumber}
        className="sticky top-0 z-10 bg-white dark:bg-slate-900"
      />
      <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
        {children}
      </div>
    </div>
  );
}
