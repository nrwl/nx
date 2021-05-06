const fs = require('fs');

const p = process.argv[2];

let r = fs.readFileSync(`packages/${p}/README.md`).toString();
r = r.replace(
  `{{links}}`,
  fs.readFileSync('scripts/readme-fragments/links.md')
);
r = r.replace(
  `{{what-is-nx}}`,
  fs.readFileSync('scripts/readme-fragments/what-is-nx.md')
);
r = r.replace(
  `{{getting-started}}`,
  fs.readFileSync('scripts/readme-fragments/getting-started.md')
);
r = r.replace(
  `{{resources}}`,
  fs.readFileSync('scripts/readme-fragments/resources.md')
);

fs.writeFileSync(`build/packages/${p}/README.md`, r);
