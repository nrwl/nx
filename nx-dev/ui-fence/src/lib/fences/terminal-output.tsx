import { ReactNode } from 'react';
import { TerminalShellWrapper } from './terminal-shell';

export function TerminalOutput({
  content,
  command,
  path,
}: {
  content: ReactNode | null;
  command: string;
  path: string;
}): JSX.Element {
  const commandLines = command.split('\n').filter(Boolean);
  return (
    <TerminalShellWrapper>
      <div className="overflow-x-auto p-4 pt-2">
        <div className="items-left flex flex-col">
          {commandLines.map((line, index) => {
            return (
              <div key={index} className="flex">
                <p className="mt-0.5">
                  {path && (
                    <span className="text-purple-600 dark:text-fuchsia-500">
                      {path}
                    </span>
                  )}
                  <span className="mx-1 text-green-600 dark:text-green-400">
                    ❯
                  </span>
                </p>
                <p className="typing mt-0.5 flex-1 pl-2">{line}</p>
              </div>
            );
          })}
        </div>
        <div className="not-prose flex">{content}</div>
      </div>
    </TerminalShellWrapper>
  );
}
