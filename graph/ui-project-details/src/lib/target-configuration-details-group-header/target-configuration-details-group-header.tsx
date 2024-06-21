import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { Pill } from '../pill';

export interface TargetConfigurationGroupHeaderProps {
  targetGroupName: string;
  targetsNumber: number;
  className?: string;
  atomizer?: boolean;
  connectedToCloud?: boolean;
}

export const TargetConfigurationGroupHeader = ({
  targetGroupName,
  targetsNumber,
  atomizer,
  connectedToCloud = true,
  className = '',
}: TargetConfigurationGroupHeaderProps) => {
  return (
    <header
      className={`flex items-center gap-2 px-4 py-2 text-lg capitalize ${className}`}
    >
      {targetGroupName}{' '}
      <Pill
        text={
          targetsNumber.toString() +
          (targetsNumber === 1 ? ' target' : ' targets')
        }
      />
      {atomizer && (
        <Tooltip
          openAction="hover"
          strategy="fixed"
          content={
            (
              <PropertyInfoTooltip
                type={connectedToCloud ? 'atomizer-cloud' : 'atomizer-no-cloud'}
              />
            ) as any
          }
        >
          <span className="inline-flex">
            <Pill
              color={connectedToCloud ? 'grey' : 'yellow'}
              text={'Atomizer'}
            />
          </span>
        </Tooltip>
      )}
    </header>
  );
};
