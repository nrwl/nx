import { HandRaisedIcon } from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/24/solid';
import { getSchemaFromReference } from '@nrwl/nx-dev/data-access-packages';
import { JsonSchema1, NxSchema } from '@nrwl/nx-dev/models-package';
import { renderMarkdown } from '@nrwl/nx-dev/ui-markdoc';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { ReactNode, useState } from 'react';
import { generateJsonExampleFor, isErrors } from './examples';
import { SchemaViewModel } from './get-schema-view-model';
import { SchemaEditor } from './schema-editor';
import { SchemaViewer } from './schema-viewer';
import { Heading2, Heading3 } from './ui/headings';

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
          href: schemaViewModel.packageUrl,
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
    get markdown(): ReactNode {
      return renderMarkdown(
        getMarkdown({
          type: schemaViewModel.type,
          packageName: schemaViewModel.packageName,
          schemaName: schemaViewModel.schemaMetadata.name,
          schemaAlias: schemaViewModel.schemaMetadata.aliases[0] ?? '',
          schema: schemaViewModel.currentSchema as NxSchema,
        }),
        {
          filePath: '',
        }
      ).node;
    },
  };

  return (
    <div data-document="main" className="min-w-0 flex-auto pt-8 pb-24 lg:pb-16">
      <div className="mb-8 flex w-full items-center space-x-2">
        <div className="w-full flex-grow space-x-4">
          <div
            aria-hidden="true"
            data-tooltip="Schema type"
            className="relative inline-flex rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase dark:border-slate-700 dark:bg-slate-800/60"
          >
            {schemaViewModel.type}
          </div>
          {schemaViewModel.hidden && (
            <div
              aria-hidden="true"
              data-tooltip="Nx internal use only"
              className="relative inline-flex rounded-md border border-red-100 bg-red-50 px-4 py-2 text-xs font-medium uppercase text-red-600 dark:border-red-900 dark:bg-red-900/30 dark:text-red-400"
            >
              Internal
            </div>
          )}
        </div>
        <div className="relative z-0 inline-flex flex-shrink-0 rounded-md shadow-sm">
          <Link
            href={schemaViewModel.packageUrl}
            title="See package information"
            className="relative inline-flex items-center rounded-l-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800"
          >
            {schemaViewModel.packageName}
          </Link>
          <a
            href={schemaViewModel.schemaGithubUrl}
            target="_blank"
            rel="noreferrer"
            title="See this schema on Github"
            className="relative -ml-px inline-flex items-center rounded-r-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800"
          >
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
              ></path>
            </svg>
            See schema
          </a>
        </div>
      </div>

      {!schemaViewModel.subReference && schemaViewModel.hidden && (
        <div className="my-6 block rounded-md bg-red-50 p-4 ring-1 ring-red-100 dark:bg-red-900/30 dark:ring-red-900">
          <div className="flex">
            <div className="flex-shrink-0">
              <HandRaisedIcon
                className="h-5 w-5 text-red-500"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <div className="mt-0 block text-sm font-medium text-red-600 dark:text-red-400">
                Schema for internal use only
              </div>
              <p className="prose-sm mt-2 block text-red-700 dark:text-red-600">
                Please do not extend this schema as it is part of Nx internal
                usage.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* We remove the top description on sub property lookup */}
      {!schemaViewModel.subReference && (
        <>
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {vm.markdown}
          </div>
          <div className="h-12">{/* SPACER */}</div>
        </>
      )}

      {/*TODO@ben: create new component*/}
      {schemaViewModel.type === 'executor' && !schemaViewModel.subReference && (
        <div className="mt-8 hidden md:block">
          <Heading2 title="Options playground" />
          <p className="my-6">
            Try out this interactive editor of the configuration object. Values
            are validated as you type and hovering over labels will give you
            more information.
          </p>
          {!!schemaViewModel.currentSchema.presets.length && (
            <>
              <Heading3 title="Examples" />
              <p className="my-4">
                These buttons show the config object for specific common tasks.
              </p>
              <div className="mb-4 flex flex-wrap gap-4">
                {schemaViewModel.currentSchema.presets.map((p) => (
                  <button
                    key={'preset-' + p.name.toLowerCase()}
                    onClick={() => {
                      setPresets(p.keys);
                    }}
                    type="button"
                    className="relative inline-flex items-center rounded-md border border-slate-200 bg-white px-4 px-4 py-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    {p.name}
                  </button>
                ))}
                {!!presets.length && (
                  <button
                    onClick={() => setPresets([])}
                    type="button"
                    className="relative inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Reset <XCircleIcon className="ml-1.5 h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          )}
          <div className="rounded-md border border-slate-200 p-0.5 dark:border-slate-700">
            <SchemaEditor
              packageName={schemaViewModel.packageName}
              schemaName={schemaViewModel.schemaMetadata.name}
              type={schemaViewModel.type}
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
  );
}

const getMarkdown = (data: {
  packageName: string;
  schemaAlias: string;
  schemaName: string;
  schema: NxSchema;
  type: 'executor' | 'generator';
}): string => {
  const hasExamplesFile = !!data.schema['examplesFile'];
  const executorNotice: string = `Options can be configured in \`project.json\` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: [https://nx.dev/reference/project-configuration#targets](https://nx.dev/reference/project-configuration#targets).`;

  return [
    `# ${data.packageName}:${data.schemaName}`,
    `\n\n`,
    data.schema.description,
    '\n\n',
    data.type === 'executor' ? executorNotice : '',
    `\n\n`,
    hasExamplesFile ? data.schema['examplesFile'] : '',
    data.type === 'generator'
      ? getUsage(data.packageName, data.schemaName, data.schemaAlias)
      : '',
    !!data.schema['examples']
      ? `### Examples \n ${data.schema['examples']
          .map(
            (e: any) => `${e.description}: \n \`\`\`bash\n${e.command}\n\`\`\``
          )
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
