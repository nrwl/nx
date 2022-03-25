import { Lookup } from '@nrwl/nx-dev/data-access-packages';
import { JsonSchema } from '@nrwl/nx-dev/models-package';
import { getParameterMetadata } from './parameter-metadata';
import { getEnum } from './types/get-enum';
import { Type } from './types/type';
import { Heading3 } from './ui/headings';
import { Markdown } from './ui/markdown/markdown';

export const ParameterView = (props: {
  key: string;
  name: string;
  alias: string;
  description: string;
  required: boolean;
  deprecated: boolean;
  schema: JsonSchema | undefined;
  reference: string;
  lookup: Lookup;
}) => (
  <div key={'property-' + props.name} className="mb-8">
    <div className="mb-2 flex items-center">
      <Heading3 title={props.name} />
      <div className="ml-4 flex-grow space-x-2">
        {props.alias && (
          <span
            data-tooltip="Property alias"
            className="relative -top-0.5 inline-flex rounded-md border px-2 text-xs font-semibold uppercase leading-5 text-gray-600"
          >
            {props.alias}
          </span>
        )}
        {props.required && (
          <span className="relative -top-0.5 inline-flex rounded-md bg-gray-300 px-2 text-xs font-semibold uppercase leading-5 text-gray-800">
            Required
          </span>
        )}
        {props.deprecated && (
          <span className="relative -top-0.5 inline-flex rounded-md bg-red-100 px-2 text-xs font-semibold uppercase leading-5 text-gray-800">
            Deprecated
          </span>
        )}
        {((props.schema as any)['hidden'] as boolean) && (
          <span className="relative -top-0.5 inline-flex rounded-md bg-yellow-300 px-2 text-xs font-semibold uppercase leading-5 text-yellow-800">
            Hidden
          </span>
        )}
      </div>
    </div>
    <div className="mb-2 text-sm">
      <div className="mb-1 text-green-600">
        <Type
          s={props.schema}
          reference={props.reference}
          lookup={props.lookup}
        />
      </div>
      {props.schema && <ParameterMetadata schema={props.schema} />}
      {props.schema && (
        <ParameterEnums schema={props.schema} lookup={props.lookup} />
      )}
    </div>

    <Markdown content={props.description} />

    {props.deprecated && props.schema['x-deprecated'] && (
      <div className="mt-2 rounded-md bg-red-100 p-4">
        <Markdown content={props.schema['x-deprecated'] as string} />
      </div>
    )}
  </div>
);

function ParameterMetadata({ schema }: { schema: JsonSchema }) {
  const data = getParameterMetadata(schema);
  return !!data.length ? (
    <div className="mb-1">
      {data.map((i) => (
        <span key={i.key}>
          {i.name}: <code>{i.value}</code>
        </span>
      ))}
    </div>
  ) : null;
}

function ParameterEnums({
  schema,
  lookup,
}: {
  schema: JsonSchema;
  lookup: Lookup;
}) {
  const potentialEnums = (getEnum(schema, lookup) as string[]) ?? [];
  return !!potentialEnums.length ? (
    <div className="mb-1">
      Accepted values:{' '}
      {potentialEnums.map((e, i) => (
        <span key={'enums-' + e}>
          <code>{e}</code>
          {potentialEnums.length === i + 1 ? null : ', '}
        </span>
      ))}
    </div>
  ) : null;
}
