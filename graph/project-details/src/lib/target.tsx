/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { TargetConfiguration } from '@nx/devkit';
import PropertyRenderer from './property-renderer';
import { useState } from 'react';

/* eslint-disable-next-line */
export interface TargetProps {
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
}

export function Target(props: TargetProps) {
  return (
    <div className="ml-3 mb-3">
      <h3 className="text-lg font-bold">{props.targetName}</h3>
      <div className="ml-3">
        {Object.entries(props.targetConfiguration).map(([key, value]) =>
          PropertyRenderer({
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
