declare module 'js-tokens' {
  const jsTokens: RegExp;
  export default jsTokens;
  export function matchToToken(match: RegExpMatchArray | string[]): {
    type: string;
    value: string;
    closed?: boolean;
  };
}
