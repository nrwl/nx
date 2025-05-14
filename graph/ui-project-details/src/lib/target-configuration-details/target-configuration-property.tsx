import { JSX, ReactNode } from 'react';
import { TargetConfigurationPropertyText } from './target-configuration-property-text';

interface RenderPropertyProps {
  data: string | Record<string, any> | any[];
  disabled?: boolean;
  disabledTooltip?: ReactNode;
  children?: ReactNode;
}

export function TargetConfigurationProperty({
  data,
  children,
  disabled,
  disabledTooltip,
}: RenderPropertyProps): JSX.Element | null {
  if (typeof data === 'string') {
    return (
      <span className="flex font-mono text-sm">
        <TargetConfigurationPropertyText
          content={data}
          disabled={disabled}
          disabledTooltip={disabledTooltip}
        />
        {children}
      </span>
    );
  } else if (Array.isArray(data)) {
    return (
      <ul>
        {data.map((item, index) => (
          <li key={index} className="flex font-mono text-sm">
            <TargetConfigurationPropertyText
              content={String(item)}
              disabled={disabled}
              disabledTooltip={disabledTooltip}
            />
            {children}
          </li>
        ))}
      </ul>
    );
  } else if (typeof data === 'object') {
    return (
      <ul>
        {Object.entries(data).map(([key, value], index) => (
          <li key={index} className="flex font-mono text-sm">
            <TargetConfigurationPropertyText
              content={
                <>
                  <strong>{key}</strong>: {String(value)}
                </>
              }
              disabled={disabled}
              disabledTooltip={disabledTooltip}
            />
            {children}
          </li>
        ))}
      </ul>
    );
  } else {
    return null;
  }
}
