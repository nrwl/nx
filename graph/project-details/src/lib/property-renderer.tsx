import { getSourceInformation } from './get-source-information';

/* eslint-disable-next-line */
export interface PropertyRendererProps {
  propertyKey: string;
  propertyValue: any;
  keyPrefix?: string;
  sourceMap: Record<string, string[]>;
}

export function PropertyRenderer(props: PropertyRendererProps) {
  const { propertyKey, sourceMap, keyPrefix } = props;
  const sourceMapKey = `${keyPrefix ? `${keyPrefix}.` : ''}${propertyKey}`;
  return (
    <div title={getSourceInformation(sourceMap, sourceMapKey)}>
      <span className="font-medium">{propertyKey}</span>:{' '}
      <PropertyValueRenderer {...props} />
    </div>
  );
}

function PropertyValueRenderer(props: PropertyRendererProps) {
  const { propertyKey, propertyValue, sourceMap, keyPrefix } = props;

  if (typeof propertyValue === 'string') {
    return <code>{propertyValue}</code>;
  } else if (Array.isArray(propertyValue) && propertyValue.length) {
    return (
      <div className="ml-3">
        [
        {propertyValue.map((v) =>
          PropertyValueRenderer({
            propertyKey,
            propertyValue: v,
            sourceMap,
            keyPrefix: `${keyPrefix ? `${keyPrefix}.` : ''}${v}`,
          })
        )}
        ]
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
        <div className="ml-3">
          {'{'}
          {Object.entries(propertyValue)
            .filter(
              ([key, value]) =>
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
          {'}'}
        </div>
      </div>
    );
  }
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
    ? ']'
    : value && typeof value === 'object'
    ? '}'
    : '';
}

export default PropertyRenderer;
