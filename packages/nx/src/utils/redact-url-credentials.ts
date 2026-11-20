// Masks the userinfo in a URL: `user`, `user:pass`, or a bare token. Like a URL
// parser, it runs to the last `@` of the authority.
export function redactUrlCredentials(text: string): string {
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/?#\s]+@/gi, '$1***@');
}
