import { Schema } from '@markdoc/markdoc';
import { TerminalOutput } from '../nodes/fences/terminal-output.component';

export const terminalCommand: Schema = {
  render: 'TerminalCommand',
  attributes: {
    command: {
      type: 'String',
      required: true,
    },
    path: {
      type: 'String',
      required: false,
    },
  },
};

export function TerminalCommand({
  command,
  path,
}: {
  command: string;
  path: string;
}): JSX.Element {
  return (
    <TerminalOutput
      command={command}
      path={path}
      content={null}
      isMessageBelow={false}
    />
  );
}
