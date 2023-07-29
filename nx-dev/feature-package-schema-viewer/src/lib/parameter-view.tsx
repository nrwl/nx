import { Lookup } from '@nx/nx-dev/data-access-packages';
import { JsonSchema } from '@nx/nx-dev/models-package';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { getParameterMetadata } from './parameter-metadata';
import { getEnum } from './types/get-enum';
import { Type } from './types/type';
import { Heading3 } from './ui/headings';

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
    <div className="mb-1 flex items-center">
      <Heading3 title={props.name} />
      <div className="ml-4 flex-grow space-x-2">
        {props.alias && (
          <span
            data-tooltip="Property alias"
            className="relative -top-0.5 inline-flex rounded-md px-2 text-xs font-semibold leading-5 dark:bg-slate-700"
          >
            {props.alias}
          </span>
        )}
        {props.required && (
          <span className="relative -top-0.5 inline-flex rounded-md bg-slate-100 px-2 text-xs font-semibold uppercase leading-5 dark:bg-slate-700">
            Required
          </span>
        )}
        {props.deprecated && (
          <span className="relative -top-0.5 inline-flex rounded-md bg-red-100 px-2 text-xs font-semibold uppercase leading-5 text-red-800 dark:bg-red-800 dark:text-red-100">
            Deprecated
          </span>
        )}
        {((props.schema as any)['hidden'] as boolean) && (
          <span className="relative -top-0.5 inline-flex rounded-md bg-yellow-300 px-2 text-xs font-semibold uppercase leading-5 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
            Hidden
          </span>
        )}
      </div>
    </div>
    <div className="mb-1 text-sm">
      <div className="mb-0.5 text-green-600">
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

    <div className="prose prose-slate dark:prose-invert -mt-4 max-w-none">
      {
        renderMarkdown(props.description, {
          filePath: '',
        }).node
      }
    </div>

    {props.deprecated &&
    typeof (props.schema as any)['x-deprecated'] === 'string' ? (
      <div className="prose prose-slate dark:prose-invert mt-2 rounded-md bg-red-100 px-4 text-red-800 dark:bg-red-800 dark:text-red-100">
        {
          renderMarkdown(String((props.schema as any)['x-deprecated']), {
            filePath: '',
          }).node
        }
      </div>
    ) : null}
  </div>
);

function ParameterMetadata({ schema }: { schema: JsonSchema }) {
  const data = getParameterMetadata(schema);
  return !!data.length ? (
    <div className="mb-0.5 space-x-4">
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
    <div className="mb-0.5">
      Accepted values:{' '}
      {potentialEnums.map((e, i) => (
        <span key={'enums-' + e}>
          <code>{JSON.stringify(e).replace(/"/g, '')}</code>
          {potentialEnums.length === i + 1 ? null : ', '}
        </span>
      ))}
    </div>
  ) : null;
}
