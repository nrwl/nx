const fs = require('fs');

const p = process.argv[2];

let sourceReadmePath = `packages/${p}/README.md`;
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

console.log('WRITING', `build/packages/${p}/README.md`);

fs.writeFileSync(`build/packages/${p}/README.md`, r);
