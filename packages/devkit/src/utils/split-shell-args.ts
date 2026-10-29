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
      const parts =
        expansion.fallback === undefined
          ? [{ value: expansion.value, quoted: false }]
          : expandPosixText(expansion.fallback, quote === '"');
      for (const part of parts) {
        if (quote || part.quoted) word = (word ?? '') + part.value;
        else appendUnquoted(part.value);
      }
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
): { value: string; end: number; fallback?: string } | undefined {
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
        value: env ?? '',
        ...(useFallback ? { fallback } : {}),
        end: i,
      };
    }
  }
  return undefined;
}

interface PosixExpansionPart {
  value: string;
  quoted: boolean;
}

// Preserve which characters came from shell quotes. Quotes in an environment
// value are data, but quotes in a default word protect it from field splitting.
function expandPosixText(
  text: string,
  doubleQuoted = false
): PosixExpansionPart[] {
  const parts: PosixExpansionPart[] = [];
  let quote: '"' | "'" | undefined;
  const append = (value: string, quoted: boolean) => {
    const last = parts.at(-1);
    if (last?.quoted === quoted) last.value += value;
    else parts.push({ value, quoted });
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote === "'") {
      if (char === "'") quote = undefined;
      else append(char, true);
    } else if (char === '\\' && text[i + 1] === '\n') {
      i++;
    } else if (char === '$' && expandPosixVariable(text, i)) {
      const expansion = expandPosixVariable(text, i);
      if (expansion.fallback === undefined) {
        append(expansion.value, doubleQuoted || !!quote);
      } else {
        for (const part of expandPosixText(
          expansion.fallback,
          doubleQuoted || !!quote
        )) {
          append(part.value, doubleQuoted || !!quote || part.quoted);
        }
      }
      i = expansion.end;
    } else if (char === '"') {
      quote = quote ? undefined : '"';
      append('', true);
    } else if (char === "'" && !quote && !doubleQuoted) {
      quote = "'";
      append('', true);
    } else if (
      char === '\\' &&
      i + 1 < text.length &&
      (!(doubleQuoted || quote) || '"\\$`'.includes(text[i + 1]))
    ) {
      append(text[++i], true);
    } else {
      append(char, doubleQuoted || !!quote);
    }
  }
  return parts;
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
