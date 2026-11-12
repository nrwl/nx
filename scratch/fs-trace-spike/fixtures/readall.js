// Reads every file under argv[2]: an open-heavy Node workload.
const fs = require('fs');
const path = require('path');
let n = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile()) {
      fs.readFileSync(p);
      n++;
    }
  }
})(process.argv[2]);
console.error(`read ${n} files`);
