/**
 * Parses JSON from HTML string, handling data-code attributes and HTML entities
 * This is used by Astro components to extract JSON from code fences
 */
export function parseAstroHtmlWrappedJson(htmlString: string): any {
  // If code fence is used like "```json" then try to parse the data-code attribute for the JSON object.
  if (htmlString.includes('data-code=')) {
    // Use regex to extract data-code attribute value (works on both client and server)
    // The quotes inside are already HTML-encoded as &quot; so this regex is safe
    const dataCodeMatch = htmlString.match(/data-code="([^"]*)"/);
    if (dataCodeMatch && dataCodeMatch[1]) {
      const dataCode = dataCodeMatch[1];
      const cleanedJson = dataCode
        // Handle all variations of quote encoding (named, decimal, hexadecimal)
        .replace(/(&quot;|&quote;|&#34;|&#x22;)/g, '"')
        // Handle apostrophe/single quote
        .replace(/(&apos;|&#39;|&#x27;)/g, "'")
        // Handle ampersand
        .replace(/(&amp;|&#38;|&#x26;)/g, '&')
        // Handle less than
        .replace(/(&lt;|&#60;|&#x3C;)/g, '<')
        // Handle greater than
        .replace(/(&gt;|&#62;|&#x3E;)/g, '>')
        // Handle non-breaking space
        .replace(/(&nbsp;|&#160;|&#xA0;)/g, ' ')
        // Handle backslash (might be encoded)
        .replace(/(&#92;|&#x5C;)/g, '\\')
        // Remove all Unicode replacement characters and other non-printable characters
        .replace(
          /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,
          ''
        )
        // Also remove any remaining control characters except newline, tab, and carriage return
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      try {
        return JSON.parse(cleanedJson);
      } catch (e) {
        console.error('Failed to parse data-code JSON:', e);
      }
    }
  }

  // Fallback to original parsing method
  const cleanedString = htmlString
    .trim()
    .replace(/^<\w>|<\/\w>$/g, '')
    .trim()
    .replace(/&quot;/g, '"');
  return JSON.parse(cleanedString);
}
