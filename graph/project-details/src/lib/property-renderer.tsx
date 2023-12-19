import { getSourceInformation } from './get-source-information';
import { useState } from 'react';

/* eslint-disable-next-line */
export interface PropertyRendererProps {
  propertyKey: string;
  propertyValue: any;
  keyPrefix?: string;
  sourceMap: Record<string, string[]>;
}

export function PropertyRenderer(props: PropertyRendererProps) {
  const { propertyValue, propertyKey, sourceMap, keyPrefix } = props;
  const sourceMapKey = `${keyPrefix ? `${keyPrefix}.` : ''}${propertyKey}`;
  const isCollapsible = propertyValue && typeof propertyValue === 'object';
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      title={getSourceInformation(sourceMap, sourceMapKey)}
      className={!isCollapsible ? 'pl-4 relative' : 'relative'}
    >
      <span>
        {isCollapsible && (
          <button className="text-xs w-4" onClick={toggleCollapse}>
            {isCollapsed ? '\u25B6' : '\u25BC'}
          </button>
        )}
        <span className="font-medium">
          {propertyKey}
          <div className="absolute top-0 left-0 w-full bg-grey-500 z-10"></div>
        </span>
        : {renderOpening(propertyValue)}
      </span>

      {!isCollapsed || !isCollapsible ? (
        <PropertyValueRenderer {...props} />
      ) : (
        '...'
      )}
      {renderClosing(propertyValue)}
    </div>
  );
}

type PropertValueRendererProps = PropertyRendererProps & {
  nested?: boolean;
};

function PropertyValueRenderer(props: PropertValueRendererProps) {
  const { propertyKey, propertyValue, sourceMap, keyPrefix, nested } = props;

  if (Array.isArray(propertyValue) && propertyValue.length) {
    return (
      <div className="ml-3">
        {nested && renderOpening(propertyValue)}
        {propertyValue.map((v) =>
          PropertyValueRenderer({
            propertyKey,
            propertyValue: v,
            sourceMap,
            keyPrefix: `${keyPrefix ? `${keyPrefix}.` : ''}${v}`,
            nested: true,
          })
        )}
        {nested && renderClosing(propertyValue)}
      </div>
    );
  } else if (propertyValue && typeof propertyValue === 'object') {
    return (
      <div
        title={getSourceInformation(
          sourceMap,
          `${keyPrefix ? `${keyPrefix}.` : ''}${propertyKey}`
        )}
      >
        {nested && renderOpening(propertyValue)}
        <div className="ml-3">
          {Object.entries(propertyValue)
            .filter(
              ([, value]) =>
                value && (Array.isArray(value) ? value.length : true)
            )
            .map(([key, value]) =>
              PropertyRenderer({
                propertyKey: key,
                propertyValue: value,
                keyPrefix: `${keyPrefix ? `${keyPrefix}.` : ''}${propertyKey}`,
                sourceMap,
              })
            )}
        </div>
        {nested && renderClosing(propertyValue)}
      </div>
    );
  } else {
    return (
      <>
        <code>{`${propertyValue}`}</code>,
      </>
    );
  }
}

type PropertyKeyRendererProps = PropertyRendererProps;
function PropertyKeyRenderer(props: PropertyKeyRendererProps) {}

function isPrimitive(value: any): boolean {
  return !Array.isArray(value) && typeof value !== 'object';
}

function renderOpening(value: any): string {
  return Array.isArray(value) && value.length
    ? '['
    : value && typeof value === 'object'
    ? '{'
    : '';
}

function renderClosing(value: any): string {
  return Array.isArray(value) && value.length
    ? '],'
    : value && typeof value === 'object'
    ? '},'
    : '';
}

export default PropertyRenderer;
