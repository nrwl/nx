import { Pill } from '../pill';
import { Square3Stack3DIcon } from '@heroicons/react/24/outline';

export interface TargetConfigurationGroupHeaderProps {
  targetGroupName: string;
  targetsNumber: number;
  className?: string;
  showIcon?: boolean;
}

export const TargetConfigurationGroupHeader = ({
  targetGroupName,
  targetsNumber,

  className = '',
}: TargetConfigurationGroupHeaderProps) => {
  return (
    <header
      className={`flex items-center gap-2 px-4 py-2 text-lg capitalize ${className}`}
    >
      {targetGroupName}{' '}
      {targetGroupName !== 'Others' && (
        <Square3Stack3DIcon className="h-5 w-5" />
      )}
      <Pill
        text={
          targetsNumber.toString() +
          (targetsNumber === 1 ? ' target' : ' targets')
        }
      />
    </header>
  );
};
