import { ReactNode } from 'react';
import { TerminalShellWrapper } from './terminal-shell';

export function TerminalOutput({
  content,
  command,
  isMessageBelow,
  path,
}: {
  content: ReactNode | null;
  command: string;
  isMessageBelow: boolean;
  path: string;
}): JSX.Element {
  const commandLines = command.split('\n').filter(Boolean);
  return (
    <TerminalShellWrapper isMessageBelow={isMessageBelow}>
      <div className="p-4 pt-2 overflow-x-auto">
        <div className="flex flex-col items-left">
          {commandLines.map((line, index) => {
            return (
              <div key={index} className="flex items-center">
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
        <div className="flex not-prose">{content}</div>
      </div>
    </TerminalShellWrapper>
  );
}
