/**
 * Strip Markdoc tags from content and replace with Starlight-compatible syntax
 */
export function stripMarkdocTags(content: string): string {
  return transformTabs(transformCallouts(content));
}

/*
 * Replaces {% callout %} with asides
 */
function transformCallouts(content: string): string {
  const calloutPattern =
    /\{%\s*callout\s+type="([^"]+)"(?:\s+title="([^"]+)")?\s*%\}([\s\S]*?)\{%\s*\/callout\s*%\}/g;
  return content.replace(calloutPattern, (match, type, title, body) => {
    const typeMap: Record<string, string> = {
      note: 'note',
      caution: 'caution',
      warning: 'danger',
      info: 'tip',
    };
    const starlightType = typeMap[type] || 'note';
    const titlePart = title ? `[${title}]` : '';
    return `:::${starlightType}${titlePart}\n${body.trim()}\n:::`;
  });
}

/*
 * Removes {% tabs %} and {% tab %} and inlines the content so they read top to bottom.
 */
function transformTabs(content: string): string {
  const closedTabsPattern = /\{%\s*tabs\s*%\}([\s\S]*?)\{%\s*\/tabs\s*%\}/g;
  return content.replace(closedTabsPattern, (match, tabsContent) => {
    return extractAndTransformTabs(tabsContent);
  });
}

function extractAndTransformTabs(tabsContent: string): string {
  // Extract individual tabs
  const tabPattern =
    /\{%\s*tab\s+label="([^"]+)"\s*%\}([\s\S]*?)\{%\s*\/tab\s*%\}/g;
  const tabs: Array<{ label: string; content: string }> = [];

  let tabMatch;
  while ((tabMatch = tabPattern.exec(tabsContent)) !== null) {
    tabs.push({
      label: tabMatch[1],
      content: tabMatch[2].trim(),
    });
  }

  // Convert to headers with content
  return tabs.map((tab) => `#### ${tab.label}\n\n${tab.content}`).join('\n\n');
}
