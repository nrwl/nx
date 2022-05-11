import type { Scanner, SyntaxKind as _SyntaxKind } from 'typescript';

let SyntaxKind: typeof _SyntaxKind | undefined;
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

      /**
       * Due to the wider context of how template literals are spec'ed, a single pass of the scanner on
       * template literals is not sufficient, so we need to handle them explicitly, otherwise the scanner
       * will error with "Unterminated template literal" and our resulting code may incorrectly contain
       * additional imports/requires if they happened to be present in subsequent template literals within
       * the source file (e.g. in an Nx generator).
       *
       * See https://github.com/microsoft/TypeScript/issues/35527#issuecomment-562313057 for the minimal
       * repro within the scanner and response from the TypeScript team regarding the context.
       *
       * See the unit tests for examples of code which would previously produce incorrect results during
       * project graph creation before this case was added.
       */
      case SyntaxKind.TemplateHead:
        token = scanner.scan();
        while (token !== SyntaxKind.CloseBraceToken) {
          token = scanner.scan();
        }
        scanner.reScanTemplateHeadOrNoSubstitutionTemplate();
        break;

      default: {
        token = scanner.scan();
      }
    }
  }

  return statements.join('\n');
}
