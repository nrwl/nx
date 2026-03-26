import { setOutput } from '@actions/core';
import isCI from 'is-ci';

interface LinearCycle {
  id: string;
  number: number;
  name: string | null;
  startsAt: string;
  endsAt: string;
  completedScopeHistory: number[];
  scopeHistory: number[];
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
  cycles: {
    nodes: LinearCycle[];
  };
}

interface IssueCount {
  completed: number;
  total: number;
}

interface TeamCycleStatus {
  teamName: string;
  teamKey: string;
  status: 'in-cycle' | 'cooldown';
  currentCycle?: LinearCycle;
  nextCycle?: LinearCycle;
  daysRemaining?: number;
  daysUntilNext?: number;
  completedIssues?: number;
  totalIssues?: number;
  completionPct?: number;
  highPriCycle?: IssueCount;
  highPriMisc?: number;
}

// Active engineering teams (excluding deprecated, non-engineering teams)
const ENGINEERING_TEAM_KEYS = [
  'NXC', // Nx CLI (Dolphin)
];

const LINEAR_API_URL = 'https://api.linear.app/graphql';

async function queryLinear<T>(query: string): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY environment variable is required');
  }

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Linear API error: ${response.status} ${response.statusText}\n${body}`
    );
  }

  const json = (await response.json()) as {
    data: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(
      `Linear GraphQL error: ${json.errors.map((e) => e.message).join(', ')}`
    );
  }

  return json.data;
}

async function fetchTeamCycles(): Promise<LinearTeam[]> {
  const now = new Date();
  // Fetch cycles that overlap with a window: 4 weeks ago to 8 weeks ahead
  const from = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 56 * 24 * 60 * 60 * 1000).toISOString();

  const data = await queryLinear<{ teams: { nodes: LinearTeam[] } }>(`
    query {
      teams {
        nodes {
          id
          name
          key
          cycles(
            filter: {
              startsAt: { lt: "${to}" }
              endsAt: { gt: "${from}" }
            }
          ) {
            nodes {
              id
              number
              name
              startsAt
              endsAt
              completedScopeHistory
              scopeHistory
            }
          }
        }
      }
    }
  `);

  return data.teams.nodes.filter((t) => ENGINEERING_TEAM_KEYS.includes(t.key));
}

function getTeamCycleStatus(team: LinearTeam, now: Date): TeamCycleStatus {
  const cycles = team.cycles.nodes.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  // Find current cycle (now is between start and end)
  const currentCycle = cycles.find(
    (c) => new Date(c.startsAt) <= now && new Date(c.endsAt) > now
  );

  if (currentCycle) {
    const endsAt = new Date(currentCycle.endsAt);
    const daysRemaining = Math.ceil(
      (endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    const totalIssues =
      currentCycle.scopeHistory[currentCycle.scopeHistory.length - 1] ?? 0;
    const completedIssues =
      currentCycle.completedScopeHistory[
        currentCycle.completedScopeHistory.length - 1
      ] ?? 0;

    // Find next cycle after current
    const nextCycle = cycles.find((c) => new Date(c.startsAt) >= endsAt);

    return {
      teamName: team.name,
      teamKey: team.key,
      status: 'in-cycle',
      currentCycle,
      nextCycle,
      daysRemaining,
      completedIssues,
      totalIssues,
      completionPct:
        totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0,
    };
  }

  // No current cycle — we're in cooldown
  // Find the next upcoming cycle
  const nextCycle = cycles.find((c) => new Date(c.startsAt) > now);
  const daysUntilNext = nextCycle
    ? Math.ceil(
        (new Date(nextCycle.startsAt).getTime() - now.getTime()) /
          (24 * 60 * 60 * 1000)
      )
    : undefined;

  return {
    teamName: team.name,
    teamKey: team.key,
    status: 'cooldown',
    nextCycle,
    daysUntilNext,
  };
}

async function fetchHighPriCycleProgress(
  teamId: string,
  cycleId: string
): Promise<IssueCount> {
  // Urgent (1) + High (2) issues in the current cycle
  const data = await queryLinear<{
    total: { nodes: { id: string }[] };
    completed: { nodes: { id: string }[] };
  }>(`
    query {
      total: issues(
        filter: {
          team: { id: { eq: "${teamId}" } }
          cycle: { id: { eq: "${cycleId}" } }
          priority: { in: [1, 2] }
        }
        first: 250
      ) {
        nodes { id }
      }
      completed: issues(
        filter: {
          team: { id: { eq: "${teamId}" } }
          cycle: { id: { eq: "${cycleId}" } }
          priority: { in: [1, 2] }
          state: { type: { eq: "completed" } }
        }
        first: 250
      ) {
        nodes { id }
      }
    }
  `);

  return {
    total: data.total.nodes.length,
    completed: data.completed.nodes.length,
  };
}

async function fetchHighPriMiscCount(teamId: string): Promise<number> {
  // Urgent (1) + High (2) misc issues, not completed/canceled
  const data = await queryLinear<{
    issues: { nodes: { id: string }[] };
  }>(`
    query {
      issues(
        filter: {
          team: { id: { eq: "${teamId}" } }
          project: { name: { eq: "Miscellaneous" } }
          priority: { in: [1, 2] }
          state: { type: { nin: ["completed", "canceled"] } }
        }
        first: 250
      ) {
        nodes { id }
      }
    }
  `);

  return data.issues.nodes.length;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatSlackMessage(statuses: TeamCycleStatus[]): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const lines: string[] = [`*Weekly Cycle Status — ${today}*\n`];

  const cooldownTeams = statuses.filter((s) => s.status === 'cooldown');
  const activeTeams = statuses.filter((s) => s.status === 'in-cycle');

  // Highlight cooldown teams first (this is the primary alert)
  if (cooldownTeams.length > 0) {
    lines.push(':yellow_circle: *Teams in Cooldown*');
    for (const team of cooldownTeams) {
      const nextInfo = team.nextCycle
        ? `Next cycle (#${team.nextCycle.number}) starts ${formatDate(team.nextCycle.startsAt)} (${team.daysUntilNext}d)`
        : 'No upcoming cycle scheduled';
      lines.push(`> *${team.teamName}* — ${nextInfo}`);
      if (team.highPriMisc && team.highPriMisc > 0) {
        lines.push(
          `> :rotating_light: ${team.highPriMisc} high-pri misc issues`
        );
      }
    }
    lines.push('');
  }

  if (activeTeams.length > 0) {
    lines.push(':large_green_circle: *Teams in Active Cycle*');
    for (const team of activeTeams) {
      const cycle = team.currentCycle!;
      const dateRange = `${formatDate(cycle.startsAt)} – ${formatDate(cycle.endsAt)}`;

      lines.push(
        `> *${team.teamName}* — Cycle #${cycle.number} | ${dateRange} | ${team.daysRemaining}d left`
      );

      if (team.highPriCycle) {
        const hp = team.highPriCycle;
        const hpPct =
          hp.total > 0 ? Math.round((hp.completed / hp.total) * 100) : 0;
        lines.push(`> High priority: ${hp.completed}/${hp.total} (${hpPct}%)`);
      }
      lines.push(
        `> All issues: ${team.completedIssues}/${team.totalIssues} (${team.completionPct}%)`
      );

      if (team.daysRemaining! <= 7) {
        lines.push(`> :warning: _Cooldown starts next week_`);
      }

      if (team.highPriMisc && team.highPriMisc > 0) {
        lines.push(
          `> :rotating_light: ${team.highPriMisc} high-pri misc issues`
        );
      }
    }
    lines.push('');
  }

  // Add a summary note about upcoming cooldown transitions
  const endingSoon = activeTeams.filter((t) => t.daysRemaining! <= 7);
  if (endingSoon.length > 0) {
    const names = endingSoon.map((t) => `*${t.teamName}*`).join(', ');
    const verb = endingSoon.length > 1 ? 's end' : ' ends';
    lines.push(`:eyes: ${names} cycle${verb} this week — cooldown incoming`);
  }

  return lines.join('\n');
}

function getSlackPayload(message: string) {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
      },
    ],
  };
}

async function main() {
  const teams = await fetchTeamCycles();
  const now = new Date();
  const statuses = teams.map((team) => getTeamCycleStatus(team, now));

  // Fetch high-priority stats for each team
  await Promise.all(
    teams.map(async (team, i) => {
      const status = statuses[i];
      const promises: Promise<void>[] = [];

      if (status.currentCycle) {
        promises.push(
          fetchHighPriCycleProgress(team.id, status.currentCycle.id).then(
            (r) => {
              status.highPriCycle = r;
            }
          )
        );
      }

      promises.push(
        fetchHighPriMiscCount(team.id).then((r) => {
          status.highPriMisc = r;
        })
      );

      await Promise.all(promises);
    })
  );

  const message = formatSlackMessage(statuses);
  const payload = getSlackPayload(message);

  if (isCI) {
    setOutput('SLACK_MESSAGE', payload);
  }

  // Always print human-readable output
  console.log(message);
  console.log('\n--- Slack Payload ---');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
