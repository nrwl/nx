"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVersionPlanContent = generateVersionPlanContent;
function generateVersionPlanContent(bumps, message) {
    const frontMatter = `---
${Object.entries(bumps)
        .filter(([_, version]) => version !== 'none')
        .map(([projectOrGroup, version]) => {
        let key = projectOrGroup;
        // frontmatter parsing will blow up if we don't wrap @org/package style project names in quotes
        if (key.startsWith('@')) {
            key = `'${key}'`;
        }
        return `${key}: ${version}`;
    })
        .join('\n')}
---
`;
    return `${frontMatter}${message ? `\n${message}\n` : ''}`;
}
