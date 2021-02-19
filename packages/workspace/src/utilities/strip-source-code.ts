import { Scanner, SyntaxKind } from 'typescript';

export function stripSourceCode(scanner: Scanner, contents: string): string {
  if (contents.indexOf('loadChildren') > -1) {
    return contents;
  }
  if (contents.indexOf('require') > -1) {
    return contents;
  }

  scanner.setText(contents);
  let token = scanner.scan();
  const statements = [];
  let start = null;
  while (token !== SyntaxKind.EndOfFileToken) {
    const potentialStart = scanner.getStartPos();
    switch (token) {
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
