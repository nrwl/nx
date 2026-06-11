"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripSourceCode = stripSourceCode;
let SyntaxKind;
/**
 * @deprecated This is deprecated and will be removed in Nx 20.
 * This was not intended to be exposed.
 * Please talk to us if you need this.
 */
function stripSourceCode(scanner, contents) {
    if (!SyntaxKind) {
        SyntaxKind = require('typescript').SyntaxKind;
    }
    if (contents.indexOf('loadChildren') > -1) {
        return contents;
    }
    scanner.setText(contents);
    let token = scanner.scan();
    let lastNonTriviaToken = SyntaxKind.Unknown;
    const statements = [];
    const templateStack = [];
    let ignoringLine = false;
    let braceDepth = 0;
    let start = null;
    while (token !== SyntaxKind.EndOfFileToken) {
        const currentToken = token;
        const potentialStart = scanner.getStartPos();
        switch (token) {
            case SyntaxKind.MultiLineCommentTrivia:
            case SyntaxKind.SingleLineCommentTrivia: {
                const isMultiLineCommentTrivia = token === SyntaxKind.MultiLineCommentTrivia;
                const start = potentialStart + 2;
                token = scanner.scan();
                const end = scanner.getStartPos() - (isMultiLineCommentTrivia ? 2 : 0);
                const comment = contents.substring(start, end).trim();
                if (comment === 'nx-ignore-next-line') {
                    // reading till the end of the line
                    while (token === SyntaxKind.WhitespaceTrivia ||
                        token === SyntaxKind.NewLineTrivia) {
                        token = scanner.scan();
                    }
                    ignoringLine = true;
                }
                break;
            }
            case SyntaxKind.NewLineTrivia: {
                ignoringLine = false;
                token = scanner.scan();
                break;
            }
            case SyntaxKind.RequireKeyword:
            case SyntaxKind.ImportKeyword: {
                token = scanner.scan();
                if (ignoringLine) {
                    break;
                }
                while (token === SyntaxKind.WhitespaceTrivia ||
                    token === SyntaxKind.NewLineTrivia) {
                    token = scanner.scan();
                }
                start = potentialStart;
                break;
            }
            case SyntaxKind.TemplateHead: {
                templateStack.push(braceDepth);
                braceDepth = 0;
                token = scanner.scan();
                break;
            }
            case SyntaxKind.SlashToken: {
                if (shouldRescanSlashToken(lastNonTriviaToken)) {
                    token = scanner.reScanSlashToken();
                }
                token = scanner.scan();
                break;
            }
            case SyntaxKind.OpenBraceToken: {
                ++braceDepth;
                token = scanner.scan();
                break;
            }
            case SyntaxKind.CloseBraceToken: {
                if (braceDepth) {
                    --braceDepth;
                }
                else if (templateStack.length) {
                    token = scanner.reScanTemplateToken(false);
                    if (token === SyntaxKind.LastTemplateToken) {
                        braceDepth = templateStack.pop();
                    }
                }
                token = scanner.scan();
                break;
            }
            case SyntaxKind.ExportKeyword: {
                token = scanner.scan();
                if (ignoringLine) {
                    break;
                }
                while (token === SyntaxKind.WhitespaceTrivia ||
                    token === SyntaxKind.NewLineTrivia) {
                    token = scanner.scan();
                }
                if (token === SyntaxKind.OpenBraceToken ||
                    token === SyntaxKind.AsteriskToken ||
                    token === SyntaxKind.TypeKeyword) {
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
                }
                else {
                    token = scanner.scan();
                }
                break;
            }
            default: {
                token = scanner.scan();
            }
        }
        if (currentToken > SyntaxKind.LastTriviaToken) {
            lastNonTriviaToken = currentToken;
        }
    }
    return statements.join('\n');
}
function shouldRescanSlashToken(lastNonTriviaToken) {
    switch (lastNonTriviaToken) {
        case SyntaxKind.Identifier:
        case SyntaxKind.StringLiteral:
        case SyntaxKind.NumericLiteral:
        case SyntaxKind.BigIntLiteral:
        case SyntaxKind.RegularExpressionLiteral:
        case SyntaxKind.ThisKeyword:
        case SyntaxKind.PlusPlusToken:
        case SyntaxKind.MinusMinusToken:
        case SyntaxKind.CloseParenToken:
        case SyntaxKind.CloseBracketToken:
        case SyntaxKind.CloseBraceToken:
        case SyntaxKind.TrueKeyword:
        case SyntaxKind.FalseKeyword:
            return false;
        default:
            return true;
    }
}
