import {
  AtomizerTooltip,
  PropertyInfoTooltip,
  Tooltip,
} from '@nx/graph/ui-tooltips';
import { Pill } from '../pill';

export interface TargetConfigurationGroupHeaderProps {
  targetGroupName: string;
  targetsNumber: number;
  className?: string;
  nonAtomizedTarget?: string;
  connectedToCloud?: boolean;
  nxConnectCallback?: () => void;
}

export const TargetConfigurationGroupHeader = ({
  targetGroupName,
  targetsNumber,
  nonAtomizedTarget,
  connectedToCloud = true,
  nxConnectCallback,
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
      {nonAtomizedTarget && (
        <Tooltip
          openAction="hover"
          strategy="fixed"
          content={
            (
              <AtomizerTooltip
                connectedToCloud={connectedToCloud}
                nonAtomizedTarget={nonAtomizedTarget}
                nxConnectCallback={nxConnectCallback}
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
