import React, { ReactNode } from 'react';

type PropertyType = string | Record<string, any> | any[];

interface RenderPropertyProps {
  property: PropertyType;
  children?: ReactNode;
}

export const RenderProperty: React.FC<RenderPropertyProps> = ({
  property,
  children,
}) => {
  if (typeof property === 'string') {
    return (
      <span>
        {property}
        {children}
      </span>
    );
  } else if (Array.isArray(property)) {
    return (
      <ul>
        {property.map((item, index) => (
          <li key={index}>
            {item.toString()}
            {children}
          </li>
        ))}
      </ul>
    );
  } else if (typeof property === 'object') {
    return (
      <ul>
        {Object.entries(property).map(([key, value], index) => (
          <li key={index}>
            <strong>{key}</strong>: {value.toString()}
            {children}
          </li>
        ))}
      </ul>
    );
  } else {
    return null;
  }
};
