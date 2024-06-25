import { AtomizerTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { Pill } from '../pill';
import { Square3Stack3DIcon } from '@heroicons/react/24/outline';

export interface TargetConfigurationGroupHeaderProps {
  targetGroupName: string;
  targetsNumber: number;
  className?: string;
  nonAtomizedTarget?: string;
  connectedToCloud?: boolean;
  nxConnectCallback?: () => void;
  showIcon?: boolean;
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
      {nonAtomizedTarget && <Square3Stack3DIcon className="h-5 w-5" />}
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
          usePortal={true}
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
