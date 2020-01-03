// Returns true if char is an alpha-numberic ascii char or non-ascii char.
function isIdentifier(c: string): boolean {
  return (
    ('0' <= c && c <= '9') ||
    ('A' <= c && c <= 'Z') ||
    ('a' <= c && c <= 'z') ||
    c == '_' ||
    // Non-ascii characters are valid identifiers
    c.charCodeAt(0) >= 0x80
  );
}

const WHITESPACE_CHARS = new Set([' ', '\t', '\r', '\n']);

function isWhiteSpace(c: string): boolean {
  return WHITESPACE_CHARS.has(c);
}

const KEYWORDS_TOKENS = new Set([
  'and',
  'for',
  'if',
  'else',
  'elif',
  'in',
  'is',
  'lambda',
  'load',
  'not',
  'or',
  'def',
  'return'
]);

const DEPTH_INCREASE_CHAR = new Set(['[', '(', '{']);

const DEPTH_DESCREASE_CHAR = new Set([']', ')', '}']);

export interface Token {
  startPosition: number;
  endPosition: number;
  tokenType: TokenType;
}

export enum TokenType {
  COMMENT = 'COMMENT',
  IDENTIFIER = 'IDENTIFIER', // Can mark the name of a variable or a rule
  KEYWORD = 'KEYWORD',
  RULE_START = 'RULE_START', // Paren open / close indicate the start of a build target so we treat these as special tokens
  RULE_END = 'RULE_END',
  ASSIGNMENT = 'ASSIGNMENT', // '='
  COMMA = 'COMMA', // ',' Used inside targets, array, dicts
  STRING = 'STRING', // We don't care about the inside of strings so we lex the entire array as a token
  VALUE_OR_EXPRESSION = 'VALUE_OR_EXPRESSION' // We don't care about the insideS of dictionaries, arrays, or mathematical expressions so we parse their entirity as a single token
}

export function lexBuildFile(fileContent: string): Array<Token> {
  const tokens: Array<Token> = [];
  let index: number = 0;

  while (index < fileContent.length - 1) {
    const char = fileContent[index];

    let lastToken: Token | undefined = tokens[tokens.length - 1];
    const startPosition = index;

    function pushToken(tokenType: TokenType) {
      tokens.push({
        startPosition,
        endPosition: ++index,
        tokenType
      });
    }

    function readComment() {
      const nextChar = fileContent[++index];
      while (nextChar && nextChar !== '\n') {
        index++;
      }
    }

    function readString() {
      if (char === fileContent[index + 1] && char === fileContent[index + 2]) {
        const stringPrefix = [char, char, char].join('');
        index += 3;
        while (fileContent.slice(index - 2, index + 1) !== stringPrefix) {
          index++;
        }
      } else {
        while (true) {
          let lastChar = fileContent[index];
          const nextChar = fileContent[++index];
          if (!nextChar) {
            throw new Error('File ended before string finished');
          } else if (nextChar === '\n') {
            throw new Error('Newline in the middle of string literal');
          }
          if (nextChar === char && lastChar !== '\\') {
            break;
          }
        }
      }
    }

    if (isWhiteSpace(char)) {
      index++;
      continue;
    }

    if (isIdentifier(char)) {
      while (isIdentifier(fileContent[index + 1])) {
        index++;
      }
      const identifier = fileContent.slice(startPosition, index + 1);
      const tokenType = KEYWORDS_TOKENS.has(identifier)
        ? TokenType.KEYWORD
        : TokenType.IDENTIFIER;

      pushToken(tokenType);
      continue;
    }

    if (char === '#') {
      readComment();
      pushToken(TokenType.COMMENT);
      continue;
    }

    if (char === '(') {
      if (lastToken && lastToken.tokenType === TokenType.IDENTIFIER) {
        pushToken(TokenType.RULE_START);
      } else {
        console.log(lastToken);
        index++;
      }
      continue;
    }

    if (char === ')') {
      pushToken(TokenType.RULE_END);
      continue;
    }

    if (char === '=') {
      if (isWhiteSpace(fileContent[index + 1])) {
        pushToken(TokenType.ASSIGNMENT);
        continue;
      } else {
        throw new Error(
          'Found a random equals sign that should have been part of expression'
        );
      }
    }

    if (char === "'" || char === '"') {
      readString();
      pushToken(TokenType.STRING);
      continue;
    }

    let depth = 0;
    let nextChar = char;
    while (depth > 0 && nextChar !== '\n') {
      const nextChar = fileContent[++index];
      if (!nextChar) {
        throw new Error('File ended before value / expression finished');
      }
      if (nextChar === '#') {
        readComment();
        continue;
      } else if (nextChar === '"' || nextChar === "'") {
        readString();
        continue;
      } else if (DEPTH_INCREASE_CHAR.has(char)) {
        depth++;
      } else if (DEPTH_DESCREASE_CHAR.has(char)) {
        depth--;
      }
      break;
    }
    pushToken(TokenType.VALUE_OR_EXPRESSION);
    continue;
  }

  return tokens;
}
