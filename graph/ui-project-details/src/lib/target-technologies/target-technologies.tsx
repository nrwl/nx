import { TechnologyIcon } from '@nx/graph/ui-icons';

export interface TargetTechnologiesProps {
  technologies?: string[];
  showTooltip?: boolean;
}

export function TargetTechnologies({
  technologies,
  showTooltip,
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
        />
      ))}
    </div>
  );
}
