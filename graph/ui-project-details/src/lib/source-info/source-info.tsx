import { SourcemapInfoToolTip, Tooltip } from '@nx/graph/ui-tooltips';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';

export function SourceInfo(props: {
  data: Array<string>;
  propertyKey: string;
  color?: string;
}) {
  // Target property key is in the form `target.${targetName}`
  // Every other property within in the target has the form `target.${targetName}.${propertyName}
  const isTarget = props.propertyKey.split('.').length === 2;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Tooltip
        openAction="hover"
        strategy="fixed"
        placement="top-start"
        showTooltipArrow={false}
        content={
          (
            <SourcemapInfoToolTip
              showLink={true}
              propertyKey={props.propertyKey}
              plugin={props.data?.[1]}
              file={props.data?.[0]}
            />
          ) as any
        }
      >
        {/*<span className="italic text-gray-500">*/}
        {/*  <InformationCircleIcon className="w-3 h-3" />*/}
        {/*</span>*/}
        <span
          className={twMerge(
            'min-w-0 truncate text-sm italic',
            props.color ?? 'text-gray-500'
          )}
        >
          {isTarget ? 'Created' : 'Set'} by {props.data?.[1]} from{' '}
          {props.data?.[0]}
        </span>
      </Tooltip>
    </span>
  );
}
