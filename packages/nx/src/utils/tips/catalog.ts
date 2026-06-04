import { NX_CLOUD_URL } from '../ab-testing';

/**
 * Nx Tips catalog - source of truth for the post-run footer tip.
 *
 * Each tip is a short muted message + a command (the CTA) the user can run.
 * Commands are plain strings with {token} placeholders the client fills from
 * the finished run: {target=<default>} -> first run target (or the default),
 * {project} -> a real project from the run. Keeping commands as data (no
 * functions) matches the planned cloud-served tip shape. CLI tips only, plus a
 * single Cloud CTA (remote cache) shown when not connected.
 */

export interface TipContext {
  isCloudConnected: boolean;
  /** User explicitly opted out of Nx Cloud (NX_NO_CLOUD / neverConnectToCloud) */
  isCloudOptedOut: boolean;
  isCI: boolean;
  isInteractive: boolean;
  /** Targets in the run that just finished, e.g. ['build']. Fills {target}. */
  runTargets?: string[];
  /** A real project from the run. Fills {project}. */
  sampleProject?: string;
}

export interface NxTip {
  /** Kebab-case stable identifier for the tip */
  id: string;
  /** Short muted message, < ~70 chars */
  text: string;
  /** Command CTA - plain string with optional {target=<default>} / {project} placeholders */
  command: string;
  /** Optional docs URL - rendered as a UTM-tracked OSC 8 link (medium=tips) */
  link?: string;
  /** Optional relevance gate - tip is skipped when it returns false */
  appliesWhen?: (ctx: TipContext) => boolean;
}

export const NX_TIPS: NxTip[] = [
  // --- CLI tips (every command verified against the nx command registry) ---
  {
    id: 'affected',
    text: 'Rerun only the projects affected by your changes',
    command: 'nx affected -t {target=test}',
  },
  {
    id: 'run-many',
    text: 'Run a target across every project at once',
    command: 'nx run-many -t {target=build}',
  },
  {
    id: 'graph',
    text: 'Explore your workspace in an interactive project graph',
    command: 'nx graph',
  },
  {
    id: 'show-project',
    text: "See a project's targets, tags and dependencies",
    command: 'nx show project {project}',
  },
  {
    id: 'migrate',
    text: 'Keep your Nx version up to date',
    command: 'nx migrate',
  },
  {
    id: 'watch',
    text: 'Re-run a command whenever your files change',
    command: 'nx watch --all -- nx run-many -t build',
  },
  {
    id: 'list-plugins',
    text: 'List installed plugins and their generators',
    command: 'nx list',
  },

  // --- Single Cloud CTA (only when not connected) ---
  {
    id: 'remote-cache',
    text: 'Share your task cache across your team and CI',
    command: 'npx nx connect',
    link: NX_CLOUD_URL,
    // Not connected AND hasn't opted out - don't nag users who disabled Cloud.
    appliesWhen: (ctx) => !ctx.isCloudConnected && !ctx.isCloudOptedOut,
  },
];
