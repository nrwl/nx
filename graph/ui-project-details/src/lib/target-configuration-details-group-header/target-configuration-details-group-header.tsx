import { Pill } from '../pill';

export interface TargetConfigurationGroupHeaderProps {
  targetGroupName: string;
  targetsNumber: number;
  className?: string;
}

export const TargetConfigurationGroupHeader = ({
  targetGroupName,
  targetsNumber,
  className = '',
}: TargetConfigurationGroupHeaderProps) => {
  return (
    <header className={`px-4 py-2 text-lg capitalize ${className}`}>
      {targetGroupName}{' '}
      <Pill
        text={
          targetsNumber.toString() +
          (targetsNumber === 1 ? ' target' : ' targets')
        }
      />
    </header>
  );
};
