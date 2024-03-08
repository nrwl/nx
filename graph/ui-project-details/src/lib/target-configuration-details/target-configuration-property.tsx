/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { InputDefinition } from 'nx/src/config/workspace-json-project-json';
import { JSX, ReactNode } from 'react';

export interface RenderPropertyProps {
  data: string | InputDefinition | Record<string, any> | any[];
  children?: ReactNode;
}

export function TargetConfigurationProperty({
  data,
  children,
}: RenderPropertyProps): JSX.Element | null {
  if (typeof data === 'string') {
    return (
      <span className="font-mono flex shrink-1 text-sm">
        {data}
        {children}
      </span>
    );
  } else if (Array.isArray(data)) {
    return (
      <ul>
        {data.map((item, index) => (
          <li key={index} className="font-mono flex shrink-1 text-sm">
            {String(item)}
            {children}
          </li>
        ))}
      </ul>
    );
  } else if (typeof data === 'object') {
    return (
      <ul>
        {Object.entries(data).map(([key, value], index) => (
          <li key={index} className="font-mono flex shrink-1 text-sm">
            <strong>{key}</strong>: {String(value)}
            {children}
          </li>
        ))}
      </ul>
    );
  } else {
    return null;
  }
}
