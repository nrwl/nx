import type * as _ts from 'typescript';
import type { FileReference, Node, SourceFile, SyntaxKind } from 'typescript';
import {
  computeLineOfPosition,
  computeLineStarts,
  forEachComment,
  getPropertyAssignmentName,
  getSourceFile,
  getStringLiteralValue,
  isKeyword,
  lastOrUndefined,
} from '../../utils/typescript';

/**
 * extractFileReferences() is wrapped in a factory function in order to ensure that we can easily lazily
 * require typescript only when it is used and not evaluate our RegExps until they are needed.
 *
 * The core Scanner and pragma logic was originally adapated from:
 * https://github.com/microsoft/TypeScript/blob/ce85d647ef88183c019588bcf398320ce29b625a/src/services/preProcess.ts
 */
export function createExtractFileReferences(ts: typeof _ts) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true);
  const SyntaxKind = ts.SyntaxKind;
  const NX_IGNORE_NEXT_LINE_COMMENT = 'nx-ignore-next-line';

  const tripleSlashXMLCommentStartRegEx = /^\/\/\/\s*<(\S+)\s.*?\/>/im;
  const referencePathArgRegEx =
    /(\spath\s*=\s*)(?:(?:'([^']*)')|(?:"([^"]*)"))/im;

  /**
   * Extracts all static imports/exports, dynamic imports, commonjs require() calls and
   * TypeScript <reference path="..." /> pragmas from the current file, apart from any
   * which have had nx-ignore-next-line applied to them.
   */
  return function extractFileReferences(
    filePath: string,
    sourceText: string
  ): FileReference[] {
    let allFileReferences: FileReference[] = [];
    let lastToken: SyntaxKind;
    let currentToken: SyntaxKind;

    function nextToken() {
      lastToken = currentToken;
      currentToken = scanner.scan();
      return currentToken;
    }

    function recordModuleName() {
      const fileName = scanner.getTokenValue();
      const pos = scanner.getTokenPos();
      allFileReferences.push({ fileName, pos, end: pos + fileName.length });
    }

    /**
     * Returns true if at least one token was consumed from the stream
     */
    function tryConsumeImport(): boolean {
      if (lastToken === SyntaxKind.DotToken) {
        return false;
      }
      let token = scanner.getToken();
      if (token === SyntaxKind.ImportKeyword) {
        token = nextToken();
        if (token === SyntaxKind.OpenParenToken) {
          token = nextToken();
          if (
            token === SyntaxKind.StringLiteral ||
            token === SyntaxKind.NoSubstitutionTemplateLiteral
          ) {
            // import("mod");
            recordModuleName();
            return true;
          }
        } else if (token === SyntaxKind.StringLiteral) {
          // import "mod";
          recordModuleName();
          return true;
        } else {
          if (token === SyntaxKind.TypeKeyword) {
            const skipTypeKeyword = scanner.lookAhead(() => {
              const token = scanner.scan();
              return (
                token !== SyntaxKind.FromKeyword &&
                (token === SyntaxKind.AsteriskToken ||
                  token === SyntaxKind.OpenBraceToken ||
                  token === SyntaxKind.Identifier ||
                  isKeyword(token))
              );
            });
            if (skipTypeKeyword) {
              token = nextToken();
            }
          }

          if (token === SyntaxKind.Identifier || isKeyword(token)) {
            token = nextToken();
            if (token === SyntaxKind.FromKeyword) {
              token = nextToken();
              if (token === SyntaxKind.StringLiteral) {
                // import d from "mod";
                recordModuleName();
                return true;
              }
            } else if (token === SyntaxKind.EqualsToken) {
              if (tryConsumeRequireCall(/*skipCurrentToken*/ true)) {
                return true;
              }
            } else if (token === SyntaxKind.CommaToken) {
              // consume comma and keep going
              token = nextToken();
            } else {
              // unknown syntax
              return true;
            }
          }

          if (token === SyntaxKind.OpenBraceToken) {
            token = nextToken();
            // consume "{ a as B, c, d as D}" clauses
            // make sure that it stops on EOF
            while (
              token !== SyntaxKind.CloseBraceToken &&
              token !== SyntaxKind.EndOfFileToken
            ) {
              token = nextToken();
            }

            if (token === SyntaxKind.CloseBraceToken) {
              token = nextToken();
              if (token === SyntaxKind.FromKeyword) {
                token = nextToken();
                if (token === SyntaxKind.StringLiteral) {
                  // import {a as A} from "mod";
                  // import d, {a, b as B} from "mod"
                  recordModuleName();
                }
              }
            }
          } else if (token === SyntaxKind.AsteriskToken) {
            token = nextToken();
            if (token === SyntaxKind.AsKeyword) {
              token = nextToken();
              if (token === SyntaxKind.Identifier || isKeyword(token)) {
                token = nextToken();
                if (token === SyntaxKind.FromKeyword) {
                  token = nextToken();
                  if (token === SyntaxKind.StringLiteral) {
                    // import * as NS from "mod"
                    // import d, * as NS from "mod"
                    recordModuleName();
                  }
                }
              }
            }
          }
        }

        return true;
      }

      return false;
    }

    function tryConsumeExport(): boolean {
      let token = scanner.getToken();
      if (token === SyntaxKind.ExportKeyword) {
        token = nextToken();
        if (token === SyntaxKind.TypeKeyword) {
          const skipTypeKeyword = scanner.lookAhead(() => {
            const token = scanner.scan();
            return (
              token === SyntaxKind.AsteriskToken ||
              token === SyntaxKind.OpenBraceToken
            );
          });
          if (skipTypeKeyword) {
            token = nextToken();
          }
        }
        if (token === SyntaxKind.OpenBraceToken) {
          token = nextToken();
          // consume "{ a as B, c, d as D}" clauses
          // make sure it stops on EOF
          while (
            token !== SyntaxKind.CloseBraceToken &&
            token !== SyntaxKind.EndOfFileToken
          ) {
            token = nextToken();
          }

          if (token === SyntaxKind.CloseBraceToken) {
            token = nextToken();
            if (token === SyntaxKind.FromKeyword) {
              token = nextToken();
              if (token === SyntaxKind.StringLiteral) {
                // export {a as A} from "mod";
                // export {a, b as B} from "mod"
                recordModuleName();
              }
            }
          }
        } else if (token === SyntaxKind.AsteriskToken) {
          token = nextToken();
          if (token === SyntaxKind.FromKeyword) {
            token = nextToken();
            if (token === SyntaxKind.StringLiteral) {
              // export * from "mod"
              recordModuleName();
            }
            // JH: added support form export * as NS from "mod"
          } else if (token === SyntaxKind.AsKeyword) {
            token = nextToken();
            if (token === SyntaxKind.Identifier || isKeyword(token)) {
              token = nextToken();
              if (token === SyntaxKind.FromKeyword) {
                token = nextToken();
                if (token === SyntaxKind.StringLiteral) {
                  // export * as NS from "mod"
                  recordModuleName();
                }
              }
            }
          }
        } else if (token === SyntaxKind.ImportKeyword) {
          token = nextToken();
          if (token === SyntaxKind.TypeKeyword) {
            const skipTypeKeyword = scanner.lookAhead(() => {
              const token = scanner.scan();
              return token === SyntaxKind.Identifier || isKeyword(token);
            });
            if (skipTypeKeyword) {
              token = nextToken();
            }
          }
          if (token === SyntaxKind.Identifier || isKeyword(token)) {
            token = nextToken();
            if (token === SyntaxKind.EqualsToken) {
              if (tryConsumeRequireCall(/*skipCurrentToken*/ true)) {
                return true;
              }
            }
          }
        }

        return true;
      }

      return false;
    }

    function tryConsumeRequireCall(
      skipCurrentToken: boolean,
      allowTemplateLiterals = false
    ): boolean {
      let token = skipCurrentToken ? nextToken() : scanner.getToken();
      if (token === SyntaxKind.RequireKeyword) {
        token = nextToken();
        if (token === SyntaxKind.OpenParenToken) {
          token = nextToken();
          if (
            token === SyntaxKind.StringLiteral ||
            (allowTemplateLiterals &&
              token === SyntaxKind.NoSubstitutionTemplateLiteral)
          ) {
            //  require("mod");
            recordModuleName();
          }
        }
        return true;
      }
      return false;
    }

    function processImports(): void {
      scanner.setText(sourceText);
      nextToken();
      // Look for:
      //    import "mod";
      //    import d from "mod"
      //    import {a as A } from "mod";
      //    import * as NS from "mod"
      //    import d, {a, b as B} from "mod"
      //    import i = require("mod");
      //    import("mod");

      //    export * from "mod"
      //    export * as NS from "mod"
      //    export {a as b} from "mod"
      //    export import i = require("mod")
      //    (for JavaScript files) require("mod")

      // Do not look for:
      //    AnySymbol.import("mod")
      //    AnySymbol.nested.import("mod")

      while (true) {
        if (scanner.getToken() === SyntaxKind.EndOfFileToken) {
          break;
        }

        if (scanner.getToken() === SyntaxKind.TemplateHead) {
          const stack = [scanner.getToken()];
          let token = scanner.scan();
          loop: while (stack.length) {
            switch (token) {
              case SyntaxKind.EndOfFileToken:
                break loop;
              case SyntaxKind.ImportKeyword:
                tryConsumeImport();
                break;
              case SyntaxKind.TemplateHead:
                stack.push(token);
                break;
              case SyntaxKind.OpenBraceToken:
                if (stack.length) {
                  stack.push(token);
                }
                break;
              case SyntaxKind.CloseBraceToken:
                if (stack.length) {
                  if (lastOrUndefined(stack) === SyntaxKind.TemplateHead) {
                    if (
                      scanner.reScanTemplateToken(
                        /* isTaggedTemplate */ false
                      ) === SyntaxKind.TemplateTail
                    ) {
                      stack.pop();
                    }
                  } else {
                    stack.pop();
                  }
                }
                break;
            }
            token = scanner.scan();
          }
          nextToken();
        }

        // Check if at least one of the alternatives has moved the scanner forwards
        if (
          tryConsumeImport() ||
          tryConsumeExport() ||
          tryConsumeRequireCall(
            /*skipCurrentToken*/ false,
            /*allowTemplateLiterals*/ true
          )
        ) {
          continue;
        } else {
          nextToken();
        }
      }

      scanner.setText(undefined);
    }

    processImports();

    /**
     * Extract any <reference path="..."> pragmas from the file
     */
    for (const range of ts.getLeadingCommentRanges(sourceText, 0) || []) {
      const comment = sourceText.substring(range.pos, range.end);
      const tripleSlash =
        range.kind === SyntaxKind.SingleLineCommentTrivia &&
        tripleSlashXMLCommentStartRegEx.exec(comment);
      if (!tripleSlash) {
        continue;
      }
      const pragmaName = tripleSlash[1].toLowerCase();
      if (pragmaName !== 'reference') {
        continue;
      }
      const matchResult = referencePathArgRegEx.exec(comment);
      if (!matchResult) {
        continue; // The <reference /> does not have a path argument, ignore it
      }
      const value = matchResult[2] || matchResult[3];
      const startPos =
        range.pos + matchResult.index + matchResult[1].length + 1;

      allFileReferences.push({
        pos: startPos,
        end: startPos + value.length,
        fileName: value,
      });
    }

    /**
     * We only need to build a full ts.SourceFile (AST) if at least one of the following is true:
     *
     * 1. The source contains one or more nx-ignore-next-line comments
     * 2. The source contains legacy Angular loadChildren string syntax
     */
    let sourceFile: SourceFile | undefined;
    let lineStarts: number[] | undefined;

    const ignoredLines = new Set();

    const totalNxIgnoreNextLineOccurrences =
      sourceText.split(NX_IGNORE_NEXT_LINE_COMMENT).length - 1;
    if (totalNxIgnoreNextLineOccurrences > 0) {
      if (!sourceFile) {
        sourceFile = getSourceFile(filePath, sourceText);
      }
      if (!lineStarts) {
        lineStarts = computeLineStarts(sourceText);
      }

      forEachComment(sourceFile, (_, comment) => {
        const commentTextContents = sourceText
          .substring(
            comment.pos + 2,
            comment.kind === SyntaxKind.SingleLineCommentTrivia
              ? comment.end
              : comment.end - 2
          )
          .trim()
          .toLowerCase();
        if (commentTextContents !== NX_IGNORE_NEXT_LINE_COMMENT) {
          return;
        }

        const endLineNumberOfNxIgnoreComment = computeLineOfPosition(
          lineStarts,
          comment.end
        );

        const ignoredLine = endLineNumberOfNxIgnoreComment + 1;
        ignoredLines.add(ignoredLine);

        allFileReferences = allFileReferences.filter((file) => {
          const importLineNumber = computeLineOfPosition(lineStarts, file.pos);
          return importLineNumber !== ignoredLine;
        });
      });
    }

    const angularLoadChildrenLegacySyntaxUsage =
      /loadChildren[\s]*:[\s]*['|"|`]/;
    if (sourceText.match(angularLoadChildrenLegacySyntaxUsage)) {
      if (!sourceFile) {
        sourceFile = getSourceFile(filePath, sourceText);
      }
      if (!lineStarts) {
        lineStarts = computeLineStarts(sourceText);
      }

      function loadChildrenVisitor(node: Node) {
        if (
          ts.isPropertyAssignment(node) &&
          getPropertyAssignmentName(node) === 'loadChildren'
        ) {
          const init = node.initializer;
          // Only the legacy string syntax needs special handling
          if (
            !ts.isStringLiteral(init) &&
            !ts.isNoSubstitutionTemplateLiteral(init)
          ) {
            return;
          }

          const nodeLineNumber = computeLineOfPosition(lineStarts, init.pos);
          const isIgnored = ignoredLines.has(nodeLineNumber);
          if (!isIgnored) {
            const childrenExpr = getStringLiteralValue(init);
            if (childrenExpr) {
              allFileReferences.push({
                pos: init.pos,
                end: init.end,
                fileName: childrenExpr,
              });
            }
          }

          return; // stop traversing downwards
        }
        node.forEachChild((childNode) => loadChildrenVisitor(childNode));
      }

      sourceFile.forEachChild((node) => loadChildrenVisitor(node));
    }

    return allFileReferences;
  };
}
