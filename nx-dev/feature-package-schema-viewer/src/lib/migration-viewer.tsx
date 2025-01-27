import { MigrationMetadata } from '@nx/nx-dev/models-package';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { ReactNode } from 'react';
import { Heading3 } from './ui/headings';

function getMarkdown(migration: MigrationMetadata): ReactNode {
  return !!migration['examplesFile']
    ? renderMarkdown(migration['examplesFile'], { filePath: '' }).node
    : null;
}

export function MigrationViewer({
  schema,
}: {
  schema: MigrationMetadata;
}): JSX.Element {
  const markdown = getMarkdown(schema);

  return (
    <details className="accordion mb-4 max-w-none px-1">
      <summary className="cursor-pointer">
        <Heading3 title={schema.name}></Heading3>
      </summary>
      <div className="prose prose-slate dark:prose-invert mb-6 ml-5">
        <p>{schema.description}</p>
        <div className="my-1">
          <strong>Version</strong>: {schema.version}
        </div>
        {schema.requires && (
          <>
            <p>
              <strong>Requires</strong>
            </p>
            <table>
              <thead>
                <tr>
                  <th align="left">Name</th>
                  <th align="left">Version</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(schema.requires).map(([name, version]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {schema.packages && (
          <>
            <p>
              <strong>Packages</strong>
            </p>
            <table>
              <thead>
                <tr>
                  <th align="left">Name</th>
                  <th align="left">Version</th>
                  <th align="left">
                    Always Add to <code>package.json</code>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(schema.packages).map(
                  ([name, { version, alwaysAddToPackageJson }]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{version}</td>
                      <td>
                        {alwaysAddToPackageJson
                          ? 'Add if not installed'
                          : 'Update only'}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </>
        )}
        {markdown}
      </div>
    </details>
  );
}
