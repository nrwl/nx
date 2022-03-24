import { XCircleIcon } from '@heroicons/react/solid';
import { getSchemaFromReference } from '@nrwl/nx-dev/data-access-packages';
import { JsonSchema1, NxSchema } from '@nrwl/nx-dev/models-package';
import { Breadcrumbs } from '@nrwl/nx-dev/ui-common';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { generateJsonExampleFor, isErrors } from './examples';
import { SchemaViewModel } from './get-schema-view-model';
import { SchemaEditor } from './schema-editor';
import { SchemaViewer } from './schema-viewer';
import { Heading2, Heading3 } from './ui/headings';
import { Markdown } from './ui/markdown/markdown';

function pathCleaner(path: string): string {
  return path.split('?')[0];
}

export function Content({
  schemaViewModel,
}: {
  schemaViewModel: SchemaViewModel;
}) {
  if (!schemaViewModel.currentSchema)
    throw new Error(
      'A valid schema has to be defined for the "currentSchema" property'
    );

  const router = useRouter();
  const [presets, setPresets] = useState<string[]>([]);
  const filterWithPresets = (
    data: Record<string, any>,
    wantedProperties: string[]
  ): Record<string, any> => {
    const result: Record<string, any> = {};

    if (!wantedProperties.length) return data;

    for (const p in data) {
      if (wantedProperties.includes(p)) {
        result[p] = data[p];
      }
    }

    return result;
  };

  const vm = {
    get fullExample(): Record<string, any> {
      const examples = generateJsonExampleFor(
        schemaViewModel.currentSchema as NxSchema,
        schemaViewModel.lookup,
        'both'
      );
      return isErrors(examples) ? {} : examples.value;
    },
    get pages(): { name: string; href: string; current: boolean }[] {
      return [
        {
          name: schemaViewModel.packageName,
          href: pathCleaner(router.asPath),
          current: false,
        },
        {
          name: schemaViewModel.schemaMetadata.name,
          href: pathCleaner(router.asPath),
          current: !schemaViewModel.subReference,
        },
        !!schemaViewModel.subReference
          ? {
              name: schemaViewModel.subReference.split('/')[2],
              href: pathCleaner(router.asPath),
              current: true,
            }
          : void 0,
      ].filter(
        (x): x is { name: string; href: string; current: boolean } => !!x
      );
    },
  };

  return (
    <>
      <div className="min-w-0 flex-auto px-4 pt-8 pb-24 sm:px-6 lg:pb-16 xl:px-8">
        <div className="mb-8 flex w-full items-center space-x-2">
          <div className="w-full flex-grow">
            <div
              aria-hidden="true"
              data-tooltip="Schema type"
              className="relative inline-flex rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium uppercase text-gray-600"
            >
              {schemaViewModel.type}
            </div>
          </div>
          <div className="relative z-0 inline-flex flex-shrink-0 rounded-md shadow-sm">
            {/* TODO@ben: update to package schemas list link when available */}
            <Link href={schemaViewModel.packageUrl}>
              <a
                title="See package information"
                className="focus:ring-blue-nx-base focus:border-blue-nx-base relative inline-flex items-center rounded-l-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1"
              >
                {schemaViewModel.packageName}
              </a>
            </Link>
            <a
              href={schemaViewModel.schemaGithubUrl}
              target="_blank"
              rel="noreferrer"
              title="See this schema on Github"
              className="focus:ring-blue-nx-base focus:border-blue-nx-base relative -ml-px inline-flex items-center rounded-r-md border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1"
            >
              See schema on Github
            </a>
          </div>
        </div>

        {/* We remove the top description on sub property lookup */}
        {!schemaViewModel.subReference && (
          <>
            <Markdown
              content={getMarkdown({
                type: schemaViewModel.type,
                packageName: schemaViewModel.packageName,
                schemaName: schemaViewModel.schemaMetadata.name,
                schemaAlias: schemaViewModel.schemaMetadata.aliases[0] ?? '',
                schema: schemaViewModel.currentSchema,
              })}
            />
            <div className="h-12">{/* SPACER */}</div>
          </>
        )}

        {schemaViewModel.subReference && (
          <div className="mt-12 rounded-md bg-gray-100 p-4">
            <Breadcrumbs pages={vm.pages} />
          </div>
        )}

        {/*TODO@ben: create new component*/}
        {schemaViewModel.type === 'executors' && !schemaViewModel.subReference && (
          <div className="mt-8 hidden md:block">
            <Heading2 title="Options playground" />
            <p className="my-6">
              This is an example of what the properties looks like and their
              values. Go ahead and try, test your configuration this is a
              live-edit window, you can interact directly and get intellisense
              on property's values.
            </p>
            {!!schemaViewModel.currentSchema.presets.length && (
              <>
                <Heading3 title="Examples" />
                <p className="my-4">
                  Here are some examples to tinker with specific usages that
                  could be useful:
                </p>
                <div className="mb-4 flex flex-wrap gap-4">
                  {schemaViewModel.currentSchema.presets.map((p) => (
                    <button
                      key={'preset-' + p.name.toLowerCase()}
                      onClick={() => {
                        setPresets(p.keys);
                      }}
                      type="button"
                      className="focus:border-blue-nx-base focus:ring-blue-nx-base relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1"
                    >
                      {p.name}
                    </button>
                  ))}
                  {!!presets.length && (
                    <button
                      onClick={() => setPresets([])}
                      type="button"
                      className="focus:border-blue-nx-base focus:ring-blue-nx-base relative inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-1"
                    >
                      Reset <XCircleIcon className="ml-1.5 h-4 w-4" />
                    </button>
                  )}
                </div>
              </>
            )}
            <div className="rounded-md border border-gray-300 p-1">
              <SchemaEditor
                packageName={schemaViewModel.packageName}
                schemaName={schemaViewModel.schemaMetadata.name}
                type={schemaViewModel.type.replace('s', '') as any}
                content={filterWithPresets(vm.fullExample, presets)}
                schema={schemaViewModel.currentSchema}
              />
            </div>
          </div>
        )}

        <div className="mt-8">
          <Heading2 title="Options" />
          {!schemaViewModel.subReference && (
            <SchemaViewer
              schema={schemaViewModel.currentSchema}
              lookup={schemaViewModel.lookup}
              reference="#"
              stage={'both'}
            />
          )}
          {schemaViewModel.subReference && (
            <SchemaViewer
              schema={
                getSchemaFromReference(
                  schemaViewModel.subReference,
                  schemaViewModel.lookup
                ) as JsonSchema1
              }
              lookup={schemaViewModel.lookup}
              reference={schemaViewModel.subReference}
              stage={'both'}
            />
          )}
        </div>
      </div>
    </>
  );
}

const getMarkdown = (data: {
  packageName: string;
  schemaAlias: string;
  schemaName: string;
  schema: JsonSchema1;
  type: 'executors' | 'generators';
}): string => {
  const hasExamples = !!data.schema['examples'];
  const hasExamplesFile = !!data.schema['examplesFile'];
  const executorNotice: string = `Options can be configured in \`project.json\` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: [https://nx.dev/configuration/projectjson#targets](https://nx.dev/configuration/projectjson#targets).`;

  return [
    `# ${data.packageName}:${data.schemaName}`,
    `\n\n`,
    data.schema.description,
    '\n\n',
    data.type === 'executors' ? executorNotice : '',
    `\n\n`,
    hasExamplesFile ? data.schema['examplesFile'] : '',
    data.type === 'generators'
      ? hasExamplesFile
        ? data.schema['examplesFile']
        : getUsage(data.packageName, data.schemaName, data.schemaAlias)
      : '',
    hasExamples
      ? `### Examples \n ${data.schema['examples']
          .map((e) => `${e.description}: \n \`\`\`bash\n${e.command}\n\`\`\``)
          .join('\n')}`
      : '',
    `\n\n`,
  ].join('');
};

const getUsage = (
  packageName: string,
  schemaName: string,
  schemaAlias: string
): string => `
## Usage
\`\`\`bash
nx generate ${schemaName} ...
\`\`\`
${!!schemaAlias ? `\`\`\`bash\nnx g ${schemaAlias} ... #same\n\`\`\`\n` : ''}

By default, Nx will search for \`${schemaName}\` in the default collection provisioned in workspace.json.

You can specify the collection explicitly as follows:

\`\`\`bash
nx g ${packageName}:${schemaName} ...
\`\`\`

Show what will be generated without writing to disk:

\`\`\`bash
nx g ${schemaName} ... --dry-run
\`\`\`
`;

export default Content;
