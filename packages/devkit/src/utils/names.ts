/**
 * UPPERCASE: This regular expression uses the Unicode property \p{Lu} to match any uppercase letters. The u flag is used to indicate that the regular expression should use Unicode characters.
 * IDENTIFIER: This regular expression uses the Unicode properties \p{Alpha} and \p{N} to match any alphabetic characters or digits, as well as an underscore.
 * SEPARATORS: This regular expression matches one or more instances of an underscore, hyphen, period, or space.
 */
const UPPERCASE = /[\p{Lu}]/u;
const IDENTIFIER = /([\p{Alpha}\p{N}_]|$)/u;
const SEPARATORS = /[_.\- ]+/;

const LEADING_SEPARATORS = new RegExp('^' + SEPARATORS.source);
const SEPARATORS_AND_IDENTIFIER = new RegExp(
  SEPARATORS.source + IDENTIFIER.source,
  'gu'
);
const NUMBERS_AND_IDENTIFIER = new RegExp('\\d+' + IDENTIFIER.source, 'gu');

/**
 * Util function to generate different strings based off the provided name.
 *
 * Examples:
 *
 * ```typescript
 * names("my-name") // {name: 'my-name', className: 'MyName', propertyName: 'myName', constantName: 'MY_NAME', fileName: 'my-name'}
 * names("myName") // {name: 'myName', className: 'MyName', propertyName: 'myName', constantName: 'MY_NAME', fileName: 'my-name'}
 * ```
 * @param name
 */
export function names(name: string): {
  name: string;
  className: string;
  propertyName: string;
  constantName: string;
  fileName: string;
} {
  return {
    name,
    className: toClassName(name),
    propertyName: toPropertyName(name),
    constantName: toConstantName(name),
    fileName: toFileName(name),
  };
}

/**
 * Modifies the given string to preserve camel casing.
 * The function adds a hyphen before any uppercase characters that follow a lowercase character in the string.
 *
 * @param {string} string - The input string to be processed.
 * @param {function} toLowerCase - A function that takes a string and returns the lowercase equivalent of that string.
 * @param {function} toUpperCase - A function that takes a string and returns the uppercase equivalent of that string.
 * @returns {string} The processed string.
 */
const preserveCamelCase = (string, toLowerCase, toUpperCase) => {
  let isLastCharLower = false;
  let isLastCharUpper = false;

  for (let index = 0; index < string.length; index++) {
    const character = string[index];

    if (isLastCharLower && UPPERCASE.test(character)) {
      string = string.slice(0, index) + '-' + string.slice(index);
      isLastCharLower = false;
      isLastCharUpper = true;
      index++;
    } else {
      isLastCharLower =
        toLowerCase(character) === character &&
        toUpperCase(character) !== character;
      isLastCharUpper =
        toUpperCase(character) === character &&
        toLowerCase(character) !== character;
    }
  }

  return string;
};

/**
 * Processes the input string by replacing any matches found in the SEPARATORS_AND_IDENTIFIER and NUMBERS_AND_IDENTIFIER regular expressions with the result of calling toUpperCase on the matched value.
 *
 * @param {string} input - The input string to be processed.
 * @param {function} toUpperCase - A function that takes a string and returns the uppercase equivalent of that string.
 * @returns {string} The processed string.
 */
const postProcess = (input, toUpperCase) => {
  SEPARATORS_AND_IDENTIFIER.lastIndex = 0;
  NUMBERS_AND_IDENTIFIER.lastIndex = 0;

  return input
    .replace(SEPARATORS_AND_IDENTIFIER, (_, identifier) =>
      toUpperCase(identifier)
    )
    .replace(NUMBERS_AND_IDENTIFIER, (m) => toUpperCase(m));
};

/**
 * remove special characters excluding space and hyphen.
 *
 * @param {string} str - Input that might have special characters.
 */
function replaceNonWord(str) {
  return str.replace(/[^0-9a-zA-Z \-\_]/g, '');
}

/**
 * Hyphenated to UpperCamelCase
 */
function toClassName(str: string): string {
  return toCapitalCase(toPropertyName(str));
}

/**
 * Hyphenated to lowerCamelCase
 */
function toPropertyName(s: string): string {
  s = replaceNonWord(s);
  s = s.trim();

  if (s.length === 0) {
    return '';
  }

  const toLowerCase = (string) => string.toLowerCase();

  const toUpperCase = (string) => string.toUpperCase();

  if (s.length === 1) {
    if (SEPARATORS.test(s)) {
      return '';
    }

    return toLowerCase(s);
  }

  const hasUpperCase = s !== toLowerCase(s);

  if (hasUpperCase) {
    s = preserveCamelCase(s, toLowerCase, toUpperCase);
  }

  s = s.replace(LEADING_SEPARATORS, '');
  s = toLowerCase(s);

  return postProcess(s, toUpperCase);
}

/**
 * Hyphenated to CONSTANT_CASE
 */
function toConstantName(s: string): string {
  return toFileName(toPropertyName(s))
    .replace(/([^a-zA-Z0-9])/g, '_')
    .toUpperCase();
}

/**
 * Upper camelCase to lowercase, hyphenated
 */
function toFileName(s: string): string {
  return s
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/(?!^[_])[ _]/g, '-');
}

/**
 * Capitalizes the first letter of a string
 */
function toCapitalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
