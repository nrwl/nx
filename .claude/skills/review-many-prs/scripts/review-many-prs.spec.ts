/**
 * Unit tests for the parts with real logic: the slot pool and the PR parser.
 * Run: npx tsx .claude/skills/review-many-prs/scripts/review-many-prs.spec.ts
 */
import {
  RUNNING_SHELL,
  SlotPool,
  parsePrs,
  projectSandboxCostKb,
  startupGrace,
} from './review-many-prs';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`  FAIL ${label}\n    expected ${e}\n    actual   ${a}`);
  } else console.log(`  ok   ${label}`);
}

async function main() {
  console.log('parsePrs');
  check(
    'bare / #N / url',
    parsePrs(['36815', '#36806', 'https://github.com/nrwl/nx/pull/36789']),
    [36815, 36806, 36789]
  );
  check('comma separated', parsePrs(['1,2, 3']), [1, 2, 3]);
  check(
    'dedups',
    parsePrs(['7', '#7', 'https://github.com/nrwl/nx/pull/7']),
    [7]
  );
  try {
    parsePrs(['https://github.com/facebook/react/pull/1']);
    check('rejects foreign repo', 'no throw', 'throw');
  } catch (e: any) {
    check(
      'rejects foreign repo',
      e.message.startsWith('not an nrwl/nx PR'),
      true
    );
  }
  try {
    parsePrs(['nope']);
    check('rejects garbage', 'no throw', 'throw');
  } catch (e: any) {
    check(
      'rejects garbage',
      e.message.startsWith('cannot read a PR number'),
      true
    );
  }

  console.log('projectSandboxCostKb');
  const SEED = 6 * 1024 * 1024;
  check(
    'no prior sample falls back to the seed',
    projectSandboxCostKb(null, { freeKb: 100, live: 1 }, SEED),
    SEED
  );
  // The point of the delta: the cold first review paid a fixed store copy-up that
  // the next one does not. Averaging total-used over live count would charge the
  // next review ~4.5GB here; the delta charges what the second one actually cost.
  check(
    'charges the marginal review, not a share of the fixed cost',
    projectSandboxCostKb(
      { freeKb: 60 * 1024 * 1024, live: 1 },
      { freeKb: 59.5 * 1024 * 1024, live: 2 },
      SEED
    ),
    Math.floor(0.5 * 1024 * 1024)
  );
  check(
    'divides across a multi-sandbox jump',
    projectSandboxCostKb(
      { freeKb: 3000, live: 1 },
      { freeKb: 1000, live: 3 },
      SEED
    ),
    1000
  );
  check(
    'a release (live shrank) is not a negative cost',
    projectSandboxCostKb(
      { freeKb: 1000, live: 3 },
      { freeKb: 3000, live: 1 },
      SEED
    ),
    SEED
  );
  check(
    'freed space at equal count falls back',
    projectSandboxCostKb(
      { freeKb: 1000, live: 2 },
      { freeKb: 2000, live: 2 },
      SEED
    ),
    SEED
  );

  console.log('startupGrace');
  const t0 = 1_000_000_000_000; // now, ms
  const started = t0 / 1000; // epoch seconds, launched "now"
  check(
    'a fresh child owes the whole floor',
    startupGrace({ startedAt: started, sawWorking: false }, t0, 90),
    90_000
  );
  check(
    'partway through the floor owes the remainder',
    startupGrace({ startedAt: started, sawWorking: false }, t0 + 30_000, 90),
    60_000
  );
  check(
    'past the floor owes nothing',
    startupGrace({ startedAt: started, sawWorking: false }, t0 + 91_000, 90),
    0
  );
  check(
    'exactly at the floor owes nothing',
    startupGrace({ startedAt: started, sawWorking: false }, t0 + 90_000, 90),
    0
  );
  check(
    'seen working short-circuits the floor',
    startupGrace({ startedAt: started, sawWorking: true }, t0, 90),
    0
  );
  check(
    'never negative long after launch',
    startupGrace({ startedAt: started, sawWorking: false }, t0 + 3_600_000, 90),
    0
  );

  console.log('RUNNING_SHELL');
  check(
    'settled status line with a live shell',
    RUNNING_SHELL.test(
      '✻ Cooked for 4m 35s · done 12:50 AM · 1 shell still running'
    ),
    true
  );
  check(
    'plural',
    RUNNING_SHELL.test('done 12:50 AM · 3 shells still running'),
    true
  );
  // The transcript says this whenever the child runs anything, so matching a bare
  // "N shell" would hold every settled child forever.
  check(
    'transcript shell-command lines do not match',
    RUNNING_SHELL.test('  Ran 2 shell commands'),
    false
  );
  check(
    'footer shell count alone does not match',
    RUNNING_SHELL.test('⏵⏵ auto mode on · 1 shell · ← 5 agents'),
    false
  );

  console.log('SlotPool');
  const pool = new SlotPool(3);
  const order: string[] = [];
  let peak = 0,
    live = 0;

  const task = (name: string, ms: number) =>
    (async () => {
      const slot = await pool.acquire();
      live++;
      peak = Math.max(peak, live);
      order.push(`+${name}`);
      await sleep(ms);
      live--;
      order.push(`-${name}`);
      slot.release();
      slot.release(); // double release must not conjure a permit
    })();

  await Promise.all(
    ['a', 'b', 'c', 'd', 'e', 'f'].map((n, i) => task(n, 20 + i * 5))
  );
  check('never exceeds 3 concurrent', peak, 3);
  check('all six ran', order.filter((o) => o.startsWith('+')).length, 6);
  check('pool fully drained', (pool as any).free, 3);
  check('no waiters left', (pool as any).waiters.length, 0);
  check(
    'FIFO: d starts after a finishes',
    order.indexOf('+d') > order.indexOf('-a'),
    true
  );

  const solo = new SlotPool(1);
  const s1 = await solo.acquire();
  let got = false;
  solo.acquire().then(() => {
    got = true;
  });
  await sleep(5);
  check('blocks while the single slot is held', got, false);
  s1.release();
  await sleep(5);
  check('hands the slot straight to the waiter', got, true);

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nall green');
  process.exit(failures ? 1 : 0);
}
main();
