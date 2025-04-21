import type {
  EditorDocument,
  EditorUpdate,
  ScrollPosition,
} from '@tutorialkit/react/core';
import CodeMirrorEditor from '@tutorialkit/react/core/CodeMirrorEditor';
import FileTree from '@tutorialkit/react/core/FileTree';
import type { FileSystemTree, DirectoryNode } from '@webcontainer/api';
import type { Terminal as XTerm } from '@xterm/xterm';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useWebContainer } from './hooks/useWebcontainer';

const Terminal = lazy(() => import('@tutorialkit/react/core/Terminal'));

export default function ExampleSimpleEditor() {
  const [domLoaded, setDomLoaded] = useState(false);

  const theme = useTheme();
  const {
    setTerminal,
    previewSrc,
    document,
    files,
    onChange,
    onScroll,
    selectedFile,
    setSelectedFile,
  } = useSimpleEditor();

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  return (
    <div className="h-120 not-content react-example mt-4 flex flex-col overflow-hidden rounded border border-solid border-[var(--ec-brdCol)]">
      <div className="flex h-1/2">
        <FileTree
          className="w-1/4 flex-shrink-0 text-sm"
          files={files}
          hideRoot
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
        />
        <div className="h-full w-px flex-shrink-0 bg-[var(--ec-brdCol)]" />
        <div className="relative h-full max-w-[calc(75%-1px)] flex-grow bg-[var(--cm-backgroundColor)]">
          <CodeMirrorEditor
            theme={theme}
            doc={document}
            onChange={onChange}
            onScroll={onScroll}
            className="h-full text-[13px]"
          />
          <div className="absolute bottom-0 right-0 h-4 w-4 bg-[var(--cm-backgroundColor)]" />
        </div>
      </div>
      <div className="h-px bg-[var(--ec-brdCol)]" />
      <div className="m-0 flex h-1/2 p-0">
        <div className="h-full w-1/2">
          {domLoaded && (
            <Suspense>
              <Terminal
                className="h-full"
                readonly={false}
                theme={theme}
                onTerminalReady={setTerminal}
              />
            </Suspense>
          )}
        </div>
        <div className="h-full w-px flex-shrink-0 bg-[var(--ec-brdCol)]" />
        <div className="h-full w-1/2">
          <iframe
            className="h-full w-full border-none bg-white"
            src={previewSrc}
          />
        </div>
      </div>
    </div>
  );
}

function useSimpleEditor() {
  const webcontainerPromise = useWebContainer();
  const [terminal, setTerminal] = useState<XTerm | null>(null);
  const [selectedFile, setSelectedFile] = useState('/src/index.js');
  const [documents, setDocuments] =
    useState<Record<string, EditorDocument>>(FILES);
  const [previewSrc, setPreviewSrc] = useState<string>('');

  const document = documents[selectedFile];

  async function onChange({ content }: EditorUpdate) {
    setDocuments((prevDocuments) => ({
      ...prevDocuments,
      [selectedFile]: {
        ...prevDocuments[selectedFile],
        value: content,
      },
    }));

    const webcontainer = await webcontainerPromise;

    await webcontainer.fs.writeFile(selectedFile, content);
  }

  function onScroll(scroll: ScrollPosition) {
    setDocuments((prevDocuments) => ({
      ...prevDocuments,
      [selectedFile]: {
        ...prevDocuments[selectedFile],
        scroll,
      },
    }));
  }

  useEffect(() => {
    (async () => {
      const webcontainer = await webcontainerPromise;

      webcontainer.on('server-ready', (_port, url) => {
        setPreviewSrc(url);
      });

      await webcontainer.mount(toFileTree(FILES));
    })();
  }, []);

  useEffect(() => {
    if (!terminal) {
      return;
    }

    run(terminal);

    async function run(terminal: XTerm) {
      const webcontainer = await webcontainerPromise;
      const process = await webcontainer.spawn('jsh', ['--osc'], {
        terminal: {
          cols: terminal.cols,
          rows: terminal.rows,
        },
      });

      let isInteractive = false;
      let resolveReady!: () => void;

      const jshReady = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            if (!isInteractive) {
              const [, osc] = data.match(/\x1b\]654;([^\x07]+)\x07/) || [];

              if (osc === 'interactive') {
                // wait until we see the interactive OSC
                isInteractive = true;

                resolveReady();
              }
            }

            terminal.write(data);
          },
        })
      );

      const shellWriter = process.input.getWriter();

      terminal.onData((data) => {
        if (isInteractive) {
          shellWriter.write(data);
        }
      });

      await jshReady;

      shellWriter.write('npm install && npm start\n');
    }
  }, [terminal]);

  return {
    setTerminal,
    previewSrc,
    selectedFile,
    setSelectedFile,
    onChange,
    onScroll,
    document,
    files: FILE_PATHS,
  };
}

const FILES: Record<string, EditorDocument> = {
  '/src/index.js': {
    filePath: '/src/index.js',
    loading: false,
    value: stripIndent(`
      document.body.innerHTML = '<h1>Hello, world!</h1>';
    `),
  },
  '/src/index.html': {
    filePath: '/src/index.html',
    loading: false,
    value: stripIndent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hello, world!</title>
      </head>
      <body>
        <script src="./index.js"></script>
      </body>
      </html>
    `),
  },
  '/src/assets/logo.svg': {
    filePath: '/src/assets/logo.svg',
    loading: false,
    value: stripIndent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <rect width="24" height="24" rx="15" />
      </svg>
    `),
  },
  '/package.json': {
    filePath: '/package.json',
    loading: false,
    value: stripIndent(`
      {
        "name": "hello-world",
        "version": "1.0.0",
        "description": "Hello, world!",
        "main": "index.js",
        "scripts": {
          "start": "servor src/ --reload"
        },
        "dependencies": {
          "servor": "4.0.2"
        }
      }
    `),
  },
};

const FILE_PATHS = Object.keys(FILES).map(
  (path) => ({ path, type: 'file' } as const)
);

function stripIndent(string: string) {
  const indent = minIndent(string.slice(1));

  if (indent === 0) {
    return string;
  }

  const regex = new RegExp(`^[ \\t]{${indent}}`, 'gm');

  return string.replace(regex, '').trim();
}

function minIndent(string: string) {
  const match = string.match(/^[ \t]*(?=\S)/gm);

  if (!match) {
    return 0;
  }

  return match.reduce((acc, curr) => Math.min(acc, curr.length), Infinity);
}

export function toFileTree(
  files: Record<string, EditorDocument>
): FileSystemTree {
  const root: FileSystemTree = {};

  for (const filePath in files) {
    const segments = filePath.split('/').filter((segment) => segment);

    let currentTree: FileSystemTree = root;

    for (let i = 0; i < segments.length; ++i) {
      const name = segments[i];

      if (i === segments.length - 1) {
        currentTree[name] = {
          file: {
            contents: files[filePath].value,
          },
        };
      } else {
        let folder = currentTree[name] as DirectoryNode;

        if (!folder) {
          folder = {
            directory: {},
          };

          currentTree[name] = folder;
        }

        currentTree = folder.directory;
      }
    }
  }

  return root;
}
