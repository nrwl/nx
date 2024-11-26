/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { SourceInfo } from '../source-info/source-info';
import { selectSourceInfo } from './select-source-info';

export interface TargetSourceInfoProps {
  propertyKey: string;
  sourceMap: Record<string, string[]>;
  className?: string;
}

export function TargetSourceInfo({
  propertyKey,
  sourceMap,
  className,
}: TargetSourceInfoProps) {
  const sourceInfo = selectSourceInfo(sourceMap, propertyKey);
  if (!sourceInfo) {
    return null;
  }
  return (
    <span className={className}>
      <SourceInfo data={sourceInfo} propertyKey={propertyKey} />
    </span>
  );
}
