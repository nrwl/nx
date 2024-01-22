import Editor, { useMonaco } from '@monaco-editor/react';
import { JsonSchema } from '@nx/nx-dev/models-package';
import { useTheme } from '@nx/nx-dev/ui-theme';
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
}): JSX.Element => {
  const [theme] = useTheme();
  const monaco = useMonaco();

  useEffect(() => {
    if (!monaco) return;
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
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

    if (theme === 'system') {
      const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)');
      monaco.editor.setTheme(darkThemeMq.matches ? 'vs-dark' : 'vs-light');
    } else {
      monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs-light');
    }
  }, [monaco, schema, theme]);

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
      theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
      options={{ scrollBeyondLastLine: false }}
      saveViewState={false}
    />
  );
};
