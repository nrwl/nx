import { getSourceInformation } from './get-source-information';

/* eslint-disable-next-line */
export interface PropertyRendererProps {
  propertyKey: string;
  propertyValue: any;
  projectRoot: string;
  keyPrefix?: string;
  sourceMap: Record<string, string[]>;
}

export function PropertyRenderer(props: PropertyRendererProps) {
  if (typeof props.propertyValue === 'string') {
    return (
      <div
        title={getSourceInformation(
          props.sourceMap,
          `${props.keyPrefix ? `${props.keyPrefix}.` : ''}${props.propertyKey}`
        )}
      >
        <span className="font-medium">{props.propertyKey}</span>:{' '}
        <code>{props.propertyValue}</code>
      </div>
    );
  } else if (Array.isArray(props.propertyValue) && props.propertyValue.length) {
    return (
      <div>
        <span
          className="font-medium"
          title={getSourceInformation(
            props.sourceMap,
            `${props.keyPrefix ? `${props.keyPrefix}.` : ''}${
              props.propertyKey
            }`
          )}
        >
          {props.propertyKey}
        </span>
        :{' '}
        {props.propertyValue.map((v) => (
          <code
            className="ml-2 bg-slate-300"
            title={getSourceInformation(
              props.sourceMap,
              `${props.keyPrefix ? `${props.keyPrefix}.` : ''}${
                props.propertyKey
              }.${v}`
            )}
          >
            {v}
          </code>
        ))}
      </div>
    );
  }
}

export default PropertyRenderer;
