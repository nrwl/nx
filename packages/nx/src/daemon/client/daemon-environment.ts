const DAEMON_ENV_REQUIRED_SETTINGS = {
  NX_PROJECT_GLOB_CACHE: 'false',
  NX_CACHE_PROJECTS_CONFIG: 'false',
};

const DAEMON_ENV_OVERRIDABLE_SETTINGS = {
  NX_VERBOSE_LOGGING: 'true',
  NX_PERF_LOGGING: 'true',
  NX_NATIVE_LOGGING: 'nx=debug',
};

/**
 * Env vars that should NOT be sent to the daemon because they cannot affect
 * the project graph. Only vars that can actually affect the project graph
 * (e.g. PATH, JAVA_HOME, GRADLE_HOME) should be allowed through.
 */
const DAEMON_ENV_VARS_EXCLUSIONS = new Set([
  // Nx task-scoped vars
  'NX_TASK_TARGET_CONFIGURATION',
  'NX_TASK_TARGET_PROJECT',
  'NX_TASK_TARGET_TARGET',
  'NX_TASK_HASH',
  'NX_TERMINAL_OUTPUT_PATH',
  'NX_TERMINAL_CAPTURE_STDERR',
  'NX_STREAM_OUTPUT',
  'NX_PREFIX_OUTPUT',
  'NX_FORKED_TASK_EXECUTOR',
  'NX_SET_CLI',
  'NX_INVOKED_BY_RUNNER',
  'NX_LOAD_DOT_ENV_FILES',
  'NX_SKIP_NX_CACHE',
  'NX_CACHE_FAILURES',
  'NX_REJECT_UNKNOWN_LOCAL_CACHE',
  'NX_IGNORE_CYCLES',
  'NX_BATCH_MODE',
  'NX_CI_EXECUTION_ID',
  'NX_DAEMON_PROCESS',
  'NX_CLI_SET',
  // Set by Nx Console on the extension host; always equals the daemon's own
  // workspace root (foreign-workspace messages are rejected), and the daemon
  // resolves its root at startup before any client env is applied. The spawn
  // env keeps it so that startup resolution honors the pinned root.
  'NX_WORKSPACE_ROOT_PATH',

  // Nx UI/logging vars (don't affect graph structure)
  'NX_TUI',
  'NX_TUI_AUTO_EXIT',
  'NX_TUI_SKIP_CAPABILITY_CHECK',
  'NX_VERBOSE_LOGGING',
  'NX_PERF_LOGGING',
  'NX_NATIVE_LOGGING',
  'NX_PROFILE',
  'NX_DAEMON_VERBOSE_LOGGING',
  'NX_ORIGINAL_FORCE_COLOR',

  // AI agent detection vars (the daemon itself is not an AI agent)
  'CLAUDECODE',
  'CLAUDE_CODE',
  'REPL_ID',
  'CURSOR_TRACE_ID',
  'COMPOSER_NO_INTERACTION',
  'OPENCODE',
  'GEMINI_CLI',
  'CODEX_THREAD_ID',
  'AI_AGENT',

  // Shell mechanics
  '_',
  'SHLVL',
  'PWD',
  'OLDPWD',
  'SHELL_SESSION_ID',
  'TERM_SESSION_ID',
  'SECURITYSESSIONID',
  'COMMAND_MODE',
  'WINDOWID',
  'COLUMNS',
  'LINES',
  'TMPDIR',
  'PROMPT',

  // Package-manager per-invocation vars not covered by the npm_/pnpm_ prefixes
  'INIT_CWD',
  'COLOR',

  // Per-shell-session state; these tools' other vars are stable or can be
  // meaningful (e.g. fnm's FNM_DIR), so no prefix exclusion
  'FNM_MULTISHELL_PATH',
  'POSH_SESSION_ID',
  'MISE_SHELL',

  // Editor preference; graph computation is non-interactive
  'EDITOR',
  'VISUAL',

  // Output presentation
  'PAGER',
  'FORCE_COLOR',
  'NO_COLOR',
  'NODE_DISABLE_COLORS',
  'FORCE_HYPERLINK',

  // Terminal identification/presentation; differs per terminal app, so it
  // churns whenever clients from different terminals share the daemon
  'TERM',
  'TERM_PROGRAM',
  'TERM_PROGRAM_VERSION',
  'COLORTERM',
  'COLORFGBG',
  'VTE_VERSION',
  'GNOME_TERMINAL_SCREEN',
  'GNOME_TERMINAL_SERVICE',
  'WT_SESSION',
  'WT_PROFILE_ID',
  'TERMINAL_EMULATOR',
  'TERMINUS_SUBLIME',
  'ConEmuTask',
  'ZELLIJ_PANE_ID',
  'LC_TERMINAL',
  'LC_TERMINAL_VERSION',

  // Injected by VS Code and its extensions into integrated terminals. Single
  // entries rather than GIT_/CHROME_/COPILOT_ prefixes: GIT_DIR, CHROME_BIN,
  // COPILOT_HOME and COPILOT_GITHUB_TOKEN are functional inputs.
  'GIT_ASKPASS',
  'GIT_EDITOR',
  'GIT_PAGER',
  'GIT_MERGE_AUTOEDIT',
  'APPLICATION_INSIGHTS_NO_STATSBEAT',
  // Override for the @microsoft/mxc-sdk sandbox binaries; the SDK falls back
  // to its bundled binaries when unset
  'MXC_BIN_DIR',
  'CHROME_CRASHPAD_PIPE_NAME',
  'COPILOT_OTEL_FILE_EXPORTER_PATH',
  'COPILOT_DEBUG_NONCE',

  // Session / auth
  'SSH_AUTH_SOCK',
  'SSH_AGENT_PID',
  'XDG_SESSION_ID',
  'DBUS_SESSION_BUS_ADDRESS',
  'DISPLAY',

  // macOS internals
  '__CF_USER_TEXT_ENCODING',
  '__CFBundleIdentifier',
]);

/**
 * Env var prefixes that should never be sent to the daemon.
 * These cover CI platforms, package managers, editors, and terminals.
 */
const DAEMON_ENV_PREFIX_EXCLUSIONS = [
  // CI platforms
  'GITHUB_',
  'RUNNER_',
  'CI_JOB_',
  'CI_PIPELINE_',
  'CIRCLE_',
  'JENKINS_',
  'BUILD_',
  'AGENT_',
  'SYSTEM_TASK',

  // Package managers (process-scoped)
  'npm_',
  'pnpm_',

  // Nx Cloud runner/agent vars (per-worker values like NX_CLOUD_WORKER_ID
  // and NX_CLOUD_EXECUTION_ID diverge between distributed-execution workers
  // and cannot affect the project graph; without this every worker that
  // talks to the daemon would force a graph recompute). The cloud auth/access
  // tokens are allow-listed below — they are stable and signal cloud usage.
  'NX_CLOUD_',

  // Editors / IDEs
  'VSCODE_',
  'JETBRAINS_',
  'ELECTRON_',

  // AI agent harnesses (per-session ids; the bare CLAUDECODE/CLAUDE_CODE
  // detection vars are excluded above)
  'CLAUDE_CODE_',

  // Shell prompts / integrations (per-command and per-session state)
  'ATUIN_',
  'STARSHIP_',
  'MCFLY_',
  'DIRENV_',
  '__MISE_',

  // Terminal emulators
  'ITERM_',
  'KITTY_',
  'WEZTERM_',
  'ALACRITTY_',
  'KONSOLE_',
  'GHOSTTY_',
  'TMUX',

  // Benchmarking / profiling tools
  'HYPERFINE_', // hyperfine sets HYPERFINE_RANDOMIZED_ENVIRONMENT_OFFSET for each iteration
];

/**
 * Env var name patterns that should never be sent to the daemon. For vars
 * whose NAME embeds a process id, so neither an exact entry nor a safe
 * prefix can match them.
 */
const DAEMON_ENV_PATTERN_EXCLUSIONS = [
  // Set by Windows 11 explorer.exe as EFC_<pid> (observed as EFC_<pid>_<hash>
  // in Electron-spawned shells); regenerated on every login
  /^EFC_\d+(_\d+)?$/,
];

/**
 * Vars that match an excluded prefix but should still reach the daemon. The
 * Nx Cloud auth/access tokens are excluded by the `NX_CLOUD_` prefix, but
 * unlike the per-worker cloud vars they are stable across clients (so they
 * don't churn the daemon env) and signal that the workspace uses Nx Cloud
 * (e.g. for analytics). Keep them.
 */
const DAEMON_ENV_PREFIX_EXCLUSION_OVERRIDES = new Set([
  'NX_CLOUD_ACCESS_TOKEN',
  'NX_CLOUD_AUTH_TOKEN',
]);

function isExcludedEnvVar(key: string): boolean {
  if (
    DAEMON_ENV_VARS_EXCLUSIONS.has(key) ||
    DAEMON_ENV_PATTERN_EXCLUSIONS.some((pattern) => pattern.test(key))
  ) {
    return true;
  }
  if (DAEMON_ENV_PREFIX_EXCLUSION_OVERRIDES.has(key)) {
    return false;
  }
  return DAEMON_ENV_PREFIX_EXCLUSIONS.some((prefix) => key.startsWith(prefix));
}

export function getDaemonEnv() {
  const env: NodeJS.ProcessEnv = { ...DAEMON_ENV_OVERRIDABLE_SETTINGS };
  for (const key in process.env) {
    if (!isExcludedEnvVar(key)) {
      env[key] = process.env[key];
    }
  }
  return Object.assign(env, DAEMON_ENV_REQUIRED_SETTINGS);
}

/**
 * Env for spawning the daemon process. On top of the reflected env, it must
 * keep excluded vars the daemon needs to start correctly:
 * - ELECTRON_RUN_AS_NODE (matched by the ELECTRON_ prefix exclusion): when
 *   the spawning client runs inside an Electron host, process.execPath is
 *   the Electron binary and only this var makes it run the daemon's Node
 *   entry point.
 * - NX_WORKSPACE_ROOT_PATH: the daemon resolves its workspace root at
 *   startup by walking up from cwd looking for workspace markers; without
 *   the pin, a root without markers under an ancestor that has them
 *   resolves to the ancestor and the daemon publishes its socket under the
 *   wrong workspace.
 */
export function getDaemonSpawnEnv() {
  const env = getDaemonEnv();
  if (process.env.ELECTRON_RUN_AS_NODE !== undefined) {
    env.ELECTRON_RUN_AS_NODE = process.env.ELECTRON_RUN_AS_NODE;
  }
  if (process.env.NX_WORKSPACE_ROOT_PATH !== undefined) {
    env.NX_WORKSPACE_ROOT_PATH = process.env.NX_WORKSPACE_ROOT_PATH;
  }
  return env;
}

/**
 * Without the deletion step, a var set by one client (e.g.
 * `NX_PREFER_NODE_STRIP_TYPES=true` or `JAVA_TOOL_OPTIONS=...` for a single
 * command) would persist in the daemon and leak into every subsequent
 * client's project-graph computation. Deletion skips excluded vars and
 * required settings, which the daemon owns and clients should not control.
 */
export function applyDaemonEnvFromClient(newEnv: NodeJS.ProcessEnv): string[] {
  const changedKeys: string[] = [];
  const allKeys = new Set([
    ...Object.keys(process.env),
    ...Object.keys(newEnv),
  ]);
  for (const key of allKeys) {
    if (key in newEnv) {
      if (process.env[key] !== newEnv[key]) {
        process.env[key] = newEnv[key];
        changedKeys.push(key);
      }
    } else if (
      !isExcludedEnvVar(key) &&
      !Object.hasOwn(DAEMON_ENV_REQUIRED_SETTINGS, key)
    ) {
      delete process.env[key];
      changedKeys.push(key);
    }
  }
  return changedKeys;
}
