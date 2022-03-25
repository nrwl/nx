import Editor, { useMonaco } from '@monaco-editor/react';
import { JsonSchema } from '@nrwl/nx-dev/models-package';
import { useEffect } from 'react';

export const SchemaEditor = ({
  packageName,
  schemaName,
  type,
  content,
  schema,
}: {
  packageName: string;
  schemaName: string;
  type: 'executor' | 'generator';
  content: Record<string, any>;
  schema: JsonSchema;
}) => {
  const monaco = useMonaco();

  useEffect(() => {
    monaco?.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      schemas: [
        {
          uri: 'https://json-schema.app/example.json', // id of the first schema
          fileMatch: ['a://b/example.json'],
          schema: schema,
        },
      ],
    });
  }, [monaco, schema]);

  return (
    <Editor
      height="50vh"
      defaultLanguage="json"
      value={
        `// "${type}": "${packageName}:${schemaName}", \n` +
        `// "options": \n` +
        JSON.stringify(content, null, 2)
      }
      path="a://b/example.json"
      theme="vs-light"
      options={{ scrollBeyondLastLine: false }}
      saveViewState={false}
    />
  );
};
