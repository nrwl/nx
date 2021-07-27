export function extractTitle(markdownContent: string): string | null {
  return (
    /^\s*#\s+(?<title>.+)[\n.]+/.exec(markdownContent)?.groups?.title ?? null
  );
}
