import { TechnologyIcon } from '@nx/graph/ui-icons';
import { HTMLProps } from 'react';

export interface TargetTechnologiesProps extends HTMLProps<HTMLDivElement> {
  technologies?: string[];
  showTooltip?: boolean;
}

export function TargetTechnologies({
  technologies,
  showTooltip,
  ...props
}: TargetTechnologiesProps) {
  if (!technologies || technologies.length === 0) {
    return null;
  }
  return (
    <div className="flex gap-2">
      {technologies.map((technology, index) => (
        <TechnologyIcon
          key={index}
          technology={technology}
          showTooltip={showTooltip}
          monochromatic={true}
          {...props}
        />
      ))}
    </div>
  );
}
