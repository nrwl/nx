#!/usr/bin/env node
// Computes the target-train version options for a migration authoring task
// (SKILL.md section 2). Anchored on the npm dist-tags: a prerelease `next`
// above `latest` is an active prerelease train; anything else means the train
// rolled over and the next cut starts a new minor. Requires the repo's
// node_modules to be installed; `semver` resolves from there.
import { execSync } from 'node:child_process';
import semver from 'semver';

function bail(reason) {
  console.error(
    `${reason}; compute the options by hand per SKILL.md section 2.`
  );
  process.exit(1);
}

let distTags;
try {
  distTags = JSON.parse(
    execSync('npm view nx dist-tags --json', {
      encoding: 'utf-8',
      timeout: 30_000,
    })
  );
} catch (e) {
  bail(`Could not read the nx dist-tags (${String(e.message).split('\n')[0]})`);
}
const { latest, next } = distTags ?? {};
if (!semver.valid(latest) || !semver.valid(next) || semver.prerelease(latest)) {
  bail(`Unexpected nx dist-tags (latest: ${latest}, next: ${next})`);
}

const options = [];
if (semver.prerelease(next) && semver.gt(next, latest)) {
  options.push({
    version: semver.inc(next, 'prerelease'),
    reason: `next prerelease on the active train (next is ${next})`,
    recommended: true,
  });
} else {
  // A stable next above latest (mid-promotion) means the rollover already
  // happened; anchor the new minor on it so the result is not backdated.
  const base = semver.gt(next, latest) ? next : latest;
  options.push({
    version: `${semver.inc(base, 'minor')}-beta.0`,
    reason: `first prerelease of the next minor (train rolled over: next is ${next})`,
    recommended: true,
  });
}
if (semver.major(next) <= semver.major(latest)) {
  options.push({
    version: `${semver.inc(latest, 'major')}-beta.0`,
    reason:
      'next major at beta.0, for breaking work aimed at the upcoming major (the branch, not this field, chooses the ship vehicle: merges only after the train switch)',
    recommended: false,
  });
}

console.log(`nx dist-tags: latest ${latest}, next ${next}\n`);
for (const { version, reason, recommended } of options) {
  console.log(`${recommended ? '*' : ' '} ${version}  ${reason}`);
}
console.log(
  '\n* recommended default for non-interactive runs. Interactive runs present every option plus free text (SKILL.md section 2).'
);
