const fs = require('fs');

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

const outputPath = possibleOutputPath ?? `dist/packages/${p}/README.md`;

console.log('WRITING', outputPath);

fs.writeFileSync(outputPath, r);
