import type { Scanner } from 'typescript';

let SyntaxKind;
export function stripSourceCode(scanner: Scanner, contents: string): string {
  if (!SyntaxKind) {
    SyntaxKind = require('typescript').SyntaxKind;
  }

  if (contents.indexOf('loadChildren') > -1) {
    return contents;
  }

  scanner.setText(contents);
  let token = scanner.scan();
  const statements = [];
  let start = null;
  while (token !== SyntaxKind.EndOfFileToken) {
    const potentialStart = scanner.getStartPos();
    switch (token) {
      case SyntaxKind.MultiLineCommentTrivia:
      case SyntaxKind.SingleLineCommentTrivia: {
        const isMultiLineCommentTrivia =
          token === SyntaxKind.MultiLineCommentTrivia;
        const start = potentialStart + 2;
        token = scanner.scan();
        const end = scanner.getStartPos() - (isMultiLineCommentTrivia ? 2 : 0);
        const comment = contents.substring(start, end).trim();
        if (comment === 'nx-ignore-next-line') {
          // reading till the end of the line
          while (
            token === SyntaxKind.WhitespaceTrivia ||
            token === SyntaxKind.NewLineTrivia
          ) {
            token = scanner.scan();
          }

          // ignore next line
          while (
            token !== SyntaxKind.NewLineTrivia &&
            token !== SyntaxKind.EndOfFileToken
          ) {
            token = scanner.scan();
          }
        }
        break;
      }

      case SyntaxKind.RequireKeyword:
      case SyntaxKind.ImportKeyword: {
        token = scanner.scan();
        while (
          token === SyntaxKind.WhitespaceTrivia ||
          token === SyntaxKind.NewLineTrivia
        ) {
          token = scanner.scan();
        }
        start = potentialStart;
        break;
      }

      case SyntaxKind.ExportKeyword: {
        token = scanner.scan();
        while (
          token === SyntaxKind.WhitespaceTrivia ||
          token === SyntaxKind.NewLineTrivia
        ) {
          token = scanner.scan();
        }
        if (
          token === SyntaxKind.OpenBraceToken ||
          token === SyntaxKind.AsteriskToken
        ) {
          start = potentialStart;
        }
        break;
      }

      case SyntaxKind.StringLiteral: {
        if (start !== null) {
          token = scanner.scan();
          if (token === SyntaxKind.CloseParenToken) {
            token = scanner.scan();
          }
          const end = scanner.getStartPos();
          statements.push(contents.substring(start, end));
          start = null;
        } else {
          token = scanner.scan();
        }
        break;
      }

      default: {
        token = scanner.scan();
      }
    }
  }

  return statements.join('\n');
}
