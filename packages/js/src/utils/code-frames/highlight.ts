// Adapted from https://raw.githubusercontent.com/babel/babel/4108524/packages/babel-highlight/src/index.js
import * as jsTokens from 'js-tokens';
import * as pc from 'picocolors';
import { isKeyword, isReservedWord } from './identifiers';

/**
 * Chalk styles for token types.
 */
function getDefs(colors) {
  return {
    keyword: colors.cyan,
    capitalized: colors.yellow,
    jsx_tag: colors.yellow,
    punctuator: colors.yellow,
    // bracket:  intentionally omitted.
    number: colors.magenta,
    string: colors.green,
    regex: colors.magenta,
    comment: colors.grey,
    invalid: (str: string) => colors.white(colors.bgRed(colors.bold(str))),
  };
}

/**
 * RegExp to test for newlines in terminal.
 */
const NEWLINE = /\r\n|[\n\r\u2028\u2029]/;

/**
 * RegExp to test for what seems to be a JSX tag name.
 */
const JSX_TAG = /^[a-z][\w-]*$/i;

/**
 * RegExp to test for the three types of brackets.
 */
const BRACKET = /^[()[\]{}]$/;

/**
 * Get the type of token, specifying punctuator type.
 */
function getTokenType(match) {
  const [offset, text] = match.slice(-2);
  const token = jsTokens.matchToToken(match);

  if (token.type === 'name') {
    if (isKeyword(token.value) || isReservedWord(token.value)) {
      return 'keyword';
    }

    if (
      JSX_TAG.test(token.value) &&
      (text[offset - 1] === '<' || text.slice(offset - 2, 2) == '</')
    ) {
      return 'jsx_tag';
    }

    if (token.value[0] !== token.value[0].toLowerCase()) {
      return 'capitalized';
    }
  }

  if (token.type === 'punctuator' && BRACKET.test(token.value)) {
    return 'bracket';
  }

  if (
    token.type === 'invalid' &&
    (token.value === '@' || token.value === '#')
  ) {
    return 'punctuator';
  }

  return token.type;
}

/**
 * Highlight `text` using the token definitions in `defs`.
 */
function highlightTokens(defs: Object, text: string) {
  return text.replace(jsTokens.default, function (...args) {
    const type = getTokenType(args);
    const colorize = defs[type];
    if (colorize) {
      return args[0]
        .split(NEWLINE)
        .map((str) => colorize(str))
        .join('\n');
    } else {
      return args[0];
    }
  });
}

export function highlight(code: string): string {
  const defs = getDefs(pc);
  return highlightTokens(defs, code);
}
