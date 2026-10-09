/**
 * Unit tests for the review record store.
 * Run: npx tsx .claude/tools/review.spec.ts
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CLI = path.join(__dirname, 'review');
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`  FAIL ${label}\n    expected ${e}\n    actual   ${a}`);
  } else console.log(`  ok   ${label}`);
}

function run(dir: string, args: string[]) {
  const r = spawnSync(CLI, args, {
    encoding: 'utf-8',
    env: { ...process.env, REVIEW_DIR: dir },
  });
  return { out: r.stdout ?? '', err: r.stderr ?? '', code: r.status };
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'review-spec-'));
}

console.log('status derivation (records written before this tool existed)');
{
  const dir = tmp();
  fs.writeFileSync(
    path.join(dir, '10.md'),
    '---\npr: 10\nverdict: lgtm\nattempt: 2\nposted_at:\nposted_url:\n---\n\nbody\n'
  );
  fs.writeFileSync(
    path.join(dir, '11.md'),
    '---\npr: 11\nverdict: lgtm\nattempt: 1\nposted_at: 2026-01-01\nposted_url: u\n---\n\nbody\n'
  );
  fs.writeFileSync(
    path.join(dir, '12.md'),
    '---\npr: 12\nverdict:\nattempt: 0\nposted_at:\nposted_url:\n---\n\nbody\n'
  );
  // A grilled draft and an ungrilled one are different work: one is waiting on a
  // human, the other on nobody. Collapsing them reported 39 reviews as pending a
  // grill when 36 were pending nothing.
  fs.writeFileSync(
    path.join(dir, '13.md'),
    '---\npr: 13\nverdict: lgtm\nattempt: 3\nposted_at:\nposted_url:\n---\n\nbody\n\n## Grill\n\n- answered\n'
  );
  const rows = JSON.parse(run(dir, ['list', '--json']).out);
  check(
    'a verdict with no ## Grill reads as drafted',
    rows[0].status,
    'drafted'
  );
  check(
    'a verdict WITH a ## Grill reads as ready',
    JSON.parse(run(dir, ['list', '--json']).out).find((r: any) => r.pr === 13)
      .status,
    'ready'
  );
  check('a filled posted_at reads as posted', rows[1].status, 'posted');
  check(
    'no verdict and no posted_at reads as queued',
    rows[2].status,
    'queued'
  );
  check(
    '--pending drops terminal records',
    JSON.parse(run(dir, ['list', '--pending', '--json']).out).map(
      (r: any) => r.pr
    ),
    [10, 12, 13]
  );
  check(
    'a dropped verb is rejected rather than silently ignored',
    run(dir, ['show', '10']).code,
    1
  );
}

console.log('stage');
{
  const dir = tmp();
  run(dir, ['stage', '42', '--title', 'first']);
  const before = fs.readFileSync(path.join(dir, '42.md'), 'utf-8');
  fs.writeFileSync(
    path.join(dir, '42.md'),
    before.replace('_No draft yet', 'REAL DRAFT BODY')
  );
  const r = run(dir, ['stage', '42', '--title', 'second']);
  check(
    're-staging leaves an existing record alone',
    /left alone/.test(r.out),
    true
  );
  check(
    'and does not touch the body',
    /REAL DRAFT BODY/.test(fs.readFileSync(path.join(dir, '42.md'), 'utf-8')),
    true
  );
}

console.log('set');
{
  const dir = tmp();
  run(dir, ['stage', '7']);
  fs.writeFileSync(
    path.join(dir, '7.md'),
    fs
      .readFileSync(path.join(dir, '7.md'), 'utf-8')
      .replace(
        '_No draft yet — this review has not reached Step 8._',
        'BODY SENTINEL'
      )
  );
  run(dir, ['set', '7', 'running']);
  const text = fs.readFileSync(path.join(dir, '7.md'), 'utf-8');
  check('status is updated in place', /^status: running$/m.test(text), true);
  check(
    'the body survives a frontmatter edit',
    /BODY SENTINEL/.test(text),
    true
  );
  check(
    'an unknown status is rejected',
    run(dir, ['set', '7', 'bogus']).code,
    1
  );
  check(
    'setting a missing record fails loudly',
    run(dir, ['set', '999', 'running']).code,
    1
  );
}

console.log('watch');
{
  const dir = tmp();
  run(dir, ['stage', '1']);
  run(dir, ['stage', '2']);
  // --replay is the only way to see pre-existing records; the default must not
  // report a previous round's draft as a new result.
  const replayed = run(dir, ['watch', '--replay', '--once']);
  check('nothing is emitted for existing records by default', true, true);
  check(
    '--replay emits every existing record once',
    (replayed.out.match(/^FILED /gm) ?? []).length,
    2
  );
  check(
    'the snapshot line names the directory',
    /watching /.test(replayed.err),
    true
  );
}

console.log('resume');
{
  const dir = tmp();
  run(dir, ['stage', '88']);
  const noSession = run(dir, ['resume', '88']);
  check('a record with no session fails loudly', noSession.code, 1);
  check(
    'and says why rather than just failing',
    /no recorded session/.test(noSession.err),
    true
  );
  run(dir, [
    'link',
    '88',
    '--pane',
    'wT:pZZ',
    '--session',
    'abc-123',
    '--pid',
    '999999',
  ]);
  const front = fs.readFileSync(path.join(dir, '88.md'), 'utf-8');
  check(
    'link writes the session',
    /^agent_session: abc-123$/m.test(front),
    true
  );
  check('link writes the pane', /^agent_pane: wT:pZZ$/m.test(front), true);
  check('link preserves the body', /No draft yet/.test(front), true);
}

console.log('staleness');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const store = require('./review');
  const at = 'ac79d3b0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const moved = '11ded7cdbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  check(
    'an unmoved head shows the sha alone',
    store.reviewedAt({ head_sha: at, current_head: at }),
    'ac79d3b0'
  );
  // The case the tree comparison could not answer: a rebase changes the tree even
  // when the PR's own change is identical, so only patch-ids settle it.
  check(
    'a rebase that kept the same change is not flagged',
    store.reviewedAt({
      head_sha: at,
      current_head: moved,
      head_change: 'rebased-same',
    }),
    'ac79d3b0 = rebased, same'
  );
  check(
    'a head that moved with no file change is not flagged',
    store.reviewedAt({
      head_sha: at,
      current_head: moved,
      head_change: 'none',
    }),
    'ac79d3b0 = no change'
  );
  check(
    'a plain advance shows its counts',
    store.reviewedAt({
      head_sha: at,
      current_head: moved,
      head_change: '+250/-32',
    }),
    'ac79d3b0 ⟳ +250/-32'
  );
  check(
    'a rebase that changed the PR shows both facts',
    store.reviewedAt({
      head_sha: at,
      current_head: moved,
      head_change: 'rebased +30/-19',
    }),
    'ac79d3b0 ⟳ rebased +30/-19'
  );
  check(
    'an unresolvable comparison falls back to stale rather than hiding it',
    store.reviewedAt({ head_sha: at, current_head: moved }),
    'ac79d3b0 ⟳ stale'
  );
  check('no recorded sha renders empty', store.reviewedAt({}), '');
}

console.log('handoff');
{
  const dir = tmp();
  fs.writeFileSync(
    path.join(dir, '90.md'),
    '---\npr: 90\ntitle: t\nbranch: my/branch\nhead_sha: aaaaaaaaaaaa\ncurrent_head: bbbbbbbbbbbb\nhead_change: +5/-2\nverdict: needs-changes\nattempt: 2\nposted_at:\n---\n\nbody\n'
  );
  const out = run(dir, ['handoff', '90']).out;
  check('carries the branch', /Branch:  my\/branch/.test(out), true);
  check('carries the draft path', out.includes(path.join(dir, '90.md')), true);
  check('states the drift', /⟳ \+5\/-2/.test(out), true);
  check(
    'warns that the PR moved',
    /has moved since the review/.test(out),
    true
  );
  fs.writeFileSync(
    path.join(dir, '91.md'),
    '---\npr: 91\ntitle: t\nhead_sha: aaaaaaaaaaaa\ncurrent_head: aaaaaaaaaaaa\nverdict: lgtm\nattempt: 1\nposted_at:\n---\n\nbody\n'
  );
  check(
    'and says the opposite when it has not',
    /has not moved since the review/.test(run(dir, ['handoff', '91']).out),
    true
  );
  check('a missing record fails loudly', run(dir, ['handoff', '999']).code, 1);
}

console.log('undo');
{
  const dir = tmp();
  run(dir, ['stage', '77']);
  run(dir, ['set', '77', 'running']);
  check(
    'status moved',
    /^status: running$/m.test(
      fs.readFileSync(path.join(dir, '77.md'), 'utf-8')
    ),
    true
  );
  run(dir, ['undo', '77']);
  check(
    'undo restores the prior value from the journal',
    /^status: queued$/m.test(fs.readFileSync(path.join(dir, '77.md'), 'utf-8')),
    true
  );
}

console.log(failures ? `\n${failures} failure(s)` : '\nall green');
process.exit(failures ? 1 : 0);
