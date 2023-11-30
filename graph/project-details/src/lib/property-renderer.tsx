import { getSourceInformation } from './get-source-information';

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
  return (
    <div title={getSourceInformation(sourceMap, sourceMapKey)}>
      <span className="font-medium">{propertyKey}</span>:{' '}
      {renderOpening(propertyValue)}
      <PropertyValueRenderer {...props} />
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
