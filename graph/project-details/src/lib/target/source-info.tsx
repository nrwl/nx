import { SourcemapInfoToolTip, Tooltip } from '@nx/graph/ui-tooltips';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

export function SourceInfo(props: {
  data: Array<string>;
  propertyKey: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Tooltip
        openAction="hover"
        strategy="fixed"
        placement="top-start"
        showTooltipArrow={false}
        content={
          (
            <SourcemapInfoToolTip
              propertyKey={props.propertyKey}
              plugin={props.data[1]}
              file={props.data[0]}
            />
          ) as any
        }
      >
        {/*<span className="italic text-gray-500">*/}
        {/*  <InformationCircleIcon className="w-3 h-3" />*/}
        {/*</span>*/}
        <span className="italic text-gray-500">
          Created by {props.data[1]} from {props.data[0]}
        </span>
      </Tooltip>
    </span>
  );
}
