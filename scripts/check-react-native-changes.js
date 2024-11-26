const nxBase = process.argv[2];
const nxHead = process.argv[3];
const gitDiffCount = require('child_process').execSync(
  `git diff --name-only ${nxBase} ${nxHead} | (grep -E 'packages/detox|packages/react-native|packages/expo|e2e/detox|e2e/react-native|e2e/expo' || true) | wc -l`
);
console.log(parseInt(gitDiffCount.toString()) > 0);
