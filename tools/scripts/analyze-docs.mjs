#!/usr/bin/env node
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
try {
  const config = JSON.parse(
    readFileSync(new URL('../../.rawdocs.local.json', import.meta.url))
  );
  execSync(
    `node ${config.rawDocsPath}/scripts/analyze-changes.mjs ${process.argv
      .slice(2)
      .join(' ')}`,
    { stdio: 'inherit' }
  );
} catch {
  console.log(
    `Error: Run installation with:\ngh api repos/nrwl/raw-docs/contents/install.sh --jq '.content' | base64 -d | bash`
  );
}
