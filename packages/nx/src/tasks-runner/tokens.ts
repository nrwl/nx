/**
 * Nx tokens are `{name}` or `{name.path}`, optionally followed by `??`
 * fallbacks that resolve left to right: `{options.port ?? env.PORT ?? 4200}`.
 * Only the last part can be a literal, and the literal can contain tokens.
 * Braces that don't start with a token are text, so `${VAR}` or
 * `{{.State.Health.Status}}` stay as written.
 */
export type TokenNode = { kind: 'text'; text: string } | Token;

export interface Token {
  kind: 'token';
  raw: string;
  parts: TokenPart[];
}

export type TokenPart = Reference | { kind: 'literal'; nodes: TokenNode[] };

interface Reference {
  kind: 'reference';
  name: string;
  path: string | undefined;
}

export interface TokenScope {
  /** Whether `{name}` or `{name.path}` is a token. An `env.` fallback skips this check */
  isToken(name: string, path: string | undefined): boolean;
  /** The value of `{name}` or `{name.path}` */
  read(name: string, path: string | undefined): unknown;
  /**
   * Where `env.` references read from. When absent, `env.` is not a token, so
   * `{env.X}` stays text and a fallback `env.X` is a literal.
   */
  env?: { read: () => NodeJS.ProcessEnv } | { reject: () => Error };
  /** The text of a token with no value and no literal fallback */
  noValue(token: string): string;
  /** Whether a value counts as unset, as `undefined`, `null` and `''` always do */
  isUnset?(value: unknown): boolean;
  /** The text of a value; defaults to `String(value)` */
  toText?(value: unknown, token: string): string;
}

export function parseTokens(template: string, scope: TokenScope): TokenNode[] {
  const nodes: TokenNode[] = [];
  let text = '';
  let index = 0;
  let open: number;
  while ((open = template.indexOf('{', index)) !== -1) {
    const close = findClosingBrace(template, open);
    const node =
      close === -1 ? null : parseToken(template.slice(open, close + 1), scope);
    if (!node) {
      // Not a token, but a token can still sit inside it: `{a,{projectRoot}}`
      text += template.slice(index, open + 1);
      index = open + 1;
      continue;
    }
    text += template.slice(index, open);
    if (text) {
      nodes.push({ kind: 'text', text });
    }
    text = '';
    nodes.push(node);
    index = close + 1;
  }
  text += template.slice(index);
  if (text) {
    nodes.push({ kind: 'text', text });
  }
  return nodes;
}

export function resolveTokens(template: string, scope: TokenScope): string {
  return renderTokens(parseTokens(template, scope), scope);
}

export function renderTokens(nodes: TokenNode[], scope: TokenScope): string {
  return nodes
    .map((node) =>
      node.kind === 'text'
        ? node.text
        : resolveToken(node, scope, (literal) => renderTokens(literal, scope))
    )
    .join('');
}

export function resolveToken(
  token: Token,
  scope: TokenScope,
  renderLiteral: (nodes: TokenNode[]) => string
): string {
  for (const part of token.parts) {
    if (part.kind === 'literal') {
      return renderLiteral(part.nodes);
    }
    const value =
      part.name === 'env' && scope.env && 'read' in scope.env
        ? readEnv(scope.env.read(), part.path)
        : scope.read(part.name, part.path);
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !scope.isUnset?.(value)
    ) {
      return scope.toText ? scope.toText(value, token.raw) : String(value);
    }
  }
  return scope.noValue(token.raw);
}

/** Walks a dotted path; a missing step yields `undefined` */
export function readPath(value: unknown, path: string | undefined): unknown {
  if (path === undefined) {
    return value;
  }
  for (const key of path.split('.')) {
    if (
      value === undefined ||
      value === null ||
      !Object.hasOwn(value as object, key)
    ) {
      return undefined;
    }
    value = value[key];
  }
  return value;
}

function parseToken(raw: string, scope: TokenScope): Token | null {
  const sources = splitFallbacks(raw.slice(1, -1));
  if (!parseReference(sources[0], scope, true)) {
    return null;
  }
  const parts = sources.map((source, i): TokenPart => {
    const reference = parseReference(source, scope, i === 0);
    if (reference) {
      return reference;
    }
    if (i < sources.length - 1) {
      throw new Error(
        `"${raw}" has a fallback after the literal "${source}" that can never be used`
      );
    }
    return { kind: 'literal', nodes: parseTokens(source, scope) };
  });
  if (scope.env && 'reject' in scope.env && readsEnv(parts)) {
    throw scope.env.reject();
  }
  return { kind: 'token', raw, parts };
}

function readsEnv(parts: TokenPart[]): boolean {
  return parts.some((p) => p.kind === 'reference' && p.name === 'env');
}

// The names an env file can define, plus parentheses for Windows names such as
// `ProgramFiles(x86)`. A glob such as `{env.ts,env.d.ts}` stays text
const ENV_NAME = /^[\w.()-]+$/;

function parseReference(
  source: string,
  scope: TokenScope,
  first: boolean
): Reference | null {
  const dot = source.indexOf('.');
  const name = dot === -1 ? source : source.slice(0, dot);
  const path = dot === -1 ? undefined : source.slice(dot + 1);
  const isReference =
    name === 'env'
      ? scope.env !== undefined &&
        path !== undefined &&
        ENV_NAME.test(path) &&
        (!first || scope.isToken(name, path))
      : scope.isToken(name, path);
  return isReference ? { kind: 'reference', name, path } : null;
}

function findClosingBrace(template: string, open: number): number {
  let depth = 0;
  for (let i = open; i < template.length; i++) {
    if (template[i] === '{') {
      depth++;
    } else if (template[i] === '}' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

function splitFallbacks(expression: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expression.length; i++) {
    if (expression[i] === '{') {
      depth++;
    } else if (expression[i] === '}') {
      depth--;
    } else if (depth === 0 && expression.startsWith('??', i)) {
      parts.push(expression.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  parts.push(expression.slice(start));
  return parts.map((part) => part.trim());
}

// Windows env names are case-insensitive, but a copied env object keeps the
// spelling Windows reported (`Path`, not `PATH`)
export function readEnv(
  env: NodeJS.ProcessEnv,
  name: string
): string | undefined {
  if (Object.hasOwn(env, name)) {
    return env[name];
  }
  if (process.platform !== 'win32') {
    return undefined;
  }
  const upperName = name.toUpperCase();
  const key = Object.keys(env).find((k) => k.toUpperCase() === upperName);
  return key === undefined ? undefined : env[key];
}
