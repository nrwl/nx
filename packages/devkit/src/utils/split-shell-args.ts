/**
 * Splits a string into the words a command gets when a shell runs it, as
 * run-commands does: with POSIX sh rules, or on Windows with cmd.exe and the C
 * runtime's argv rules. Variables expand from `process.env`; command
 * substitution and globs stay literal.
 */
export function splitShellArgs(value: string): string[] {
  return process.platform === 'win32'
    ? splitWindowsArgs(applyCmdRules(value))
    : splitPosixArgs(value);
}

function splitPosixArgs(value: string): string[] {
  const words: string[] = [];
  let word: string | undefined;
  let quote: '"' | "'" | undefined;
  // An unquoted expansion splits into words on whitespace
  const appendUnquoted = (text: string) =>
    text.split(/[ \t\n]+/).forEach((part, index) => {
      if (index > 0 && word !== undefined) {
        words.push(word);
        word = undefined;
      }
      if (part) word = (word ?? '') + part;
    });
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quote === "'") {
      if (char === "'") quote = undefined;
      else word += char;
    } else if (char === '\\' && value[i + 1] === '\n') {
      i++;
    } else if (char === '$' && expandPosixVariable(value, i)) {
      const expansion = expandPosixVariable(value, i);
      if (quote) word += expansion.value;
      else appendUnquoted(expansion.value);
      i = expansion.end;
    } else if (quote === '"') {
      if (char === '"') {
        quote = undefined;
      } else if (char === '\\' && '"\\$`'.includes(value[i + 1])) {
        word += value[++i];
      } else {
        word += char;
      }
    } else if (/[ \t\n]/.test(char)) {
      if (word !== undefined) words.push(word);
      word = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
      word ??= '';
    } else if (char === '\\' && i + 1 < value.length) {
      word = (word ?? '') + value[++i];
    } else {
      word = (word ?? '') + char;
    }
  }
  if (word !== undefined) words.push(word);
  return words;
}

/**
 * Expands `$NAME`, `${NAME}`, `${NAME-default}` and `${NAME:-default}` at
 * `start`, returning the value and the index of its last character. Returns
 * undefined for anything else, which stays literal.
 */
function expandPosixVariable(
  value: string,
  start: number
): { value: string; end: number } | undefined {
  const name = value.slice(start + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
  if (name) {
    return { value: process.env[name] ?? '', end: start + name.length };
  }
  if (value[start + 1] !== '{') return undefined;
  let depth = 0;
  for (let i = start + 1; i < value.length; i++) {
    if (value[i] === '{') depth++;
    else if (value[i] === '}' && --depth === 0) {
      const match = value
        .slice(start + 2, i)
        .match(/^([A-Za-z_][A-Za-z0-9_]*)(?:(:?)-(.*))?$/s);
      if (!match) return undefined;
      const [, braced, colon, fallback] = match;
      const env = process.env[braced];
      const useFallback =
        fallback !== undefined && (colon ? !env : env === undefined);
      return {
        value: useFallback ? expandPosixText(fallback) : (env ?? ''),
        end: i,
      };
    }
  }
  return undefined;
}

function expandPosixText(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const expansion = text[i] === '$' && expandPosixVariable(text, i);
    if (expansion) {
      result += expansion.value;
      i = expansion.end;
    } else {
      result += text[i];
    }
  }
  return result;
}

// cmd.exe expands defined %NAME% variables, then drops each ^ outside double
// quotes and keeps the character after it
function applyCmdRules(value: string): string {
  const expanded = value.replace(
    /%([^%\s]+)%/g,
    (match, name: string) => process.env[name] ?? match
  );
  let result = '';
  let quoted = false;
  for (let i = 0; i < expanded.length; i++) {
    const char = expanded[i];
    if (char === '^' && !quoted && i + 1 < expanded.length) {
      result += expanded[++i];
    } else {
      if (char === '"') quoted = !quoted;
      result += char;
    }
  }
  return result;
}

// Backslashes are literal unless they precede a double quote, and single
// quotes are literal
function splitWindowsArgs(value: string): string[] {
  const words: string[] = [];
  let word: string | undefined;
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '\\') {
      let count = 1;
      while (value[i + count] === '\\') count++;
      i += count - 1;
      if (value[i + 1] === '"') {
        word = (word ?? '') + '\\'.repeat(Math.floor(count / 2));
        if (count % 2 === 1) {
          word += '"';
          i++;
        }
      } else {
        word = (word ?? '') + '\\'.repeat(count);
      }
    } else if (char === '"') {
      if (quoted && value[i + 1] === '"') {
        word += '"';
        i++;
      } else {
        quoted = !quoted;
        word ??= '';
      }
    } else if (!quoted && (char === ' ' || char === '\t')) {
      if (word !== undefined) words.push(word);
      word = undefined;
    } else {
      word = (word ?? '') + char;
    }
  }
  if (word !== undefined) words.push(word);
  return words;
}
