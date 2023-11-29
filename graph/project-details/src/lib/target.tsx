/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { TargetConfiguration } from '@nx/devkit';
import PropertyRenderer from './property-renderer';
import { useState } from 'react';

/* eslint-disable-next-line */
export interface TargetProps {
  projectRoot: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
}

export function Target(props: TargetProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="ml-3">
      <h3 className="text-lg" onClick={() => setIsCollapsed(!isCollapsed)}>
        {isCollapsed ? '▶' : '▼'} {props.targetName}
      </h3>
      <div className={`ml-3 ${isCollapsed ? 'hidden' : ''}`}>
        {Object.entries(props.targetConfiguration).map(([key, value]) =>
          PropertyRenderer({
            projectRoot: props.projectRoot,
            propertyKey: key,
            propertyValue: value,
            keyPrefix: `targets.${props.targetName}`,
            sourceMap: props.sourceMap,
          })
        )}
      </div>
    </div>
  );
}

export default Target;
