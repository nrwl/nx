/**
 * Rewrites local links in markdown content to include the /m prefix
 * @param content Markdown content
 * @returns Processed markdown content with rewritten links
 */
export function rewriteMarkdownLinks(content: string): string {
  // Process regular markdown links [text](url)
  let processedContent = content.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, linkText, linkUrl) => {
      // Skip external links and non-path links (like anchors)
      if (linkUrl.startsWith('http') || linkUrl.startsWith('#')) {
        return match;
      }

      // Add /m prefix to local links that start with /
      if (linkUrl.startsWith('/')) {
        return `[${linkText}](/m${linkUrl})`;
      }

      return match;
    }
  );

  // Process image links ![alt](url)
  processedContent = processedContent.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, altText, imageUrl) => {
      // Skip external image links
      if (imageUrl.startsWith('http')) {
        return match;
      }

      // Add /m prefix to local image links that start with /
      if (imageUrl.startsWith('/')) {
        return `![${altText}](/m${imageUrl})`;
      }

      return match;
    }
  );

  return processedContent;
}
