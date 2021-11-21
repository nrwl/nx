import * as chalk from 'chalk';
import * as path from 'path';
import { codeFrameColumns } from './code-frames';

export async function getFormattedDiagnostic(
  ts: typeof import('typescript'),
  workspaceRoot: string,
  diagnostic: import('typescript').Diagnostic
): Promise<string> {
  let message = '';

  const reason = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const category = diagnostic.category;

  switch (category) {
    case ts.DiagnosticCategory.Warning: {
      message += `${chalk.yellow.bold('warning')} ${chalk.gray(
        `TS${diagnostic.code}`
      )}: `;
      break;
    }
    case ts.DiagnosticCategory.Error: {
      message += `${chalk.red.bold('error')} ${chalk.gray(
        `TS${diagnostic.code}`
      )}: `;
      break;
    }
    case ts.DiagnosticCategory.Suggestion:
    case ts.DiagnosticCategory.Message:
    default: {
      message += `${chalk.cyan.bold(category === 2 ? 'suggestion' : 'info')}: `;
      break;
    }
  }

  message += reason + '\n';

  if (diagnostic.file) {
    const pos = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start!
    );
    const line = pos.line + 1;
    const column = pos.character + 1;
    const fileName = path.relative(workspaceRoot, diagnostic.file.fileName);
    message =
      `${chalk.underline.blue(`${fileName}:${line}:${column}`)} - ` + message;

    message +=
      '\n' +
      codeFrameColumns(
        diagnostic.file.getFullText(diagnostic.file.getSourceFile()),
        {
          start: { line: line, column },
        }
      );
  }

  return message;
}
