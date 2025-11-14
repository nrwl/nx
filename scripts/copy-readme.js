const fs = require('fs');
const { execSync } = require('child_process');

const p = process.argv[2];
const possibleInputPath = process.argv[3];
const possibleOutputPath = process.argv[4];

let sourceReadmePath = `packages/${p}/README.md`;
if (possibleInputPath && fs.existsSync(possibleInputPath)) {
  sourceReadmePath = possibleInputPath;
}

// we need exception for linter
if (p === 'linter') {
  sourceReadmePath = 'packages/eslint/README.md';
}
let r = fs.readFileSync(sourceReadmePath).toString();
let hasTemplateReplacements = false;

// Track if any template replacements were made
const originalContent = r;
r = r.replace(
  `{{links}}`,
  fs.readFileSync('scripts/readme-fragments/links.md')
);
r = r.replace(
  `{{content}}`,
  fs.readFileSync('scripts/readme-fragments/content.md')
);
r = r.replace(
  `{{resources}}`,
  fs.readFileSync('scripts/readme-fragments/resources.md')
);

if (r !== originalContent) {
  hasTemplateReplacements = true;
}

const outputPath = possibleOutputPath ?? `dist/packages/${p}/README.md`;

console.log('WRITING', outputPath);

fs.writeFileSync(outputPath, r);

// Run prettier if template replacements were made
if (hasTemplateReplacements) {
  console.log('Running prettier on', outputPath);
  try {
    execSync(`npx prettier --write "${outputPath}"`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to run prettier:', error.message);
  }
}
