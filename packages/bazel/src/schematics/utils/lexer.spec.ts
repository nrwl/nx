import { lexBuildFile, TokenType } from './lexer';
import { Token } from '@angular/compiler/src/ml_parser/lexer';

describe('@nrwl/bazel lexer', () => {
  // it('should lex a string', () => {
  //   const string = '"Im a string"';
  //   const tokens = lexBuildFile(string);
  //   expect(tokens.length).toBe(1);
  //   expect(tokens[0]).toEqual({
  //     startPosition: 0,
  //     endPosition: string.length,
  //     tokenType: 'STRING'
  //   });
  // });

  // it('should ignore whitespace', () => {
  //   const string = '"Im a string"';
  //   const stringWithWhitespace = `  \t\n\r
  //   ${string}

  //   \t\n\r
  //   `;
  //   const tokens = lexBuildFile(stringWithWhitespace);
  //   console.log(tokens);
  //   expect(tokens.length).toBe(1);
  //   expect(tokens[0]).toEqual({
  //     startPosition: stringWithWhitespace.indexOf(string),
  //     endPosition: stringWithWhitespace.indexOf(string) + string.length,
  //     tokenType: 'STRING'
  //   });
  // });

  // it('should lex a multi-line string', () => {
  //   const string = `"""Im a string
  //   """`;
  //   const tokens = lexBuildFile(string);
  //   expect(tokens.length).toBe(1);
  //   expect(tokens[0]).toEqual({
  //     startPosition: 0,
  //     endPosition: string.length,
  //     tokenType: 'STRING'
  //   });
  // });

  it('should lex the most basic build rule', () => {
    const tokens = lexBuildFile(`filegroup(name = "some group")`);
    console.log(tokens);
    expect(tokens.map(token => token.tokenType)).toEqual([
      TokenType.IDENTIFIER,
      TokenType.RULE_START,
      TokenType.IDENTIFIER,
      TokenType.ASSIGNMENT,
      TokenType.STRING,
      TokenType.RULE_END
    ]);
  });

  // it('should be lex a valid build file', async () => {
  //   const buildFile = `
  //   """
  //   I'M A MULTILINE STRING # asd
  //   """

  //   # I'm a comment

  //   filegroup(
  //       name = "root-files",
  //       # Root Files
  //       # blah = []
  //       srcs = [
  //           # Root Files
  //           "package.json",
  //           ".editorconfig",
  //           ".gitignore",
  //           ".prettierignore",  # inline comment
  //           ".prettierrc",
  //           "README.md",
  //           "angular.json",
  //           "jest.config.js",
  //           "nx.json",
  //           "tsconfig.json",
  //           "tslint.json",
  //           "karma.conf.js",
  //           "yarn.lock",
  //       ],
  //       visibility = ["//:__subpackages__"],
  //   )
  //   `;

  //   const tokens = lexBuildFile(buildFile);
  //   expect(tokens.length).toBeGreaterThan(0);
  // });
});
