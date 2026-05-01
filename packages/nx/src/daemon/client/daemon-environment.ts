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

  // Nx UI/logging vars (don't affect graph structure)
  'NX_TUI',
  'NX_TUI_AUTO_EXIT',
  'NX_TUI_SKIP_CAPABILITY_CHECK',
  'NX_VERBOSE_LOGGING',
  'NX_PERF_LOGGING',
  'NX_NATIVE_LOGGING',
  'NX_PROFILE',
  'NX_DAEMON_VERBOSE_LOGGING',

  // AI agent detection vars (the daemon itself is not an AI agent)
  'CLAUDECODE',
  'CLAUDE_CODE',
  'REPL_ID',
  'CURSOR_TRACE_ID',
  'COMPOSER_NO_INTERACTION',
  'OPENCODE',
  'GEMINI_CLI',

  // Shell mechanics
  '_',
  'SHLVL',
  'OLDPWD',
  'SHELL_SESSION_ID',
  'TERM_SESSION_ID',
  'SECURITYSESSIONID',
  'COMMAND_MODE',
  'WINDOWID',
  'COLUMNS',
  'LINES',
  'TMPDIR',

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

  // Editors / IDEs
  'VSCODE_',
  'JETBRAINS_',

  // Terminal emulators
  'ITERM_',
  'KITTY_',
  'WEZTERM_',
  'ALACRITTY_',
  'KONSOLE_',
  'TMUX',

  // Benchmarking / profiling tools
  'HYPERFINE_', // hyperfine sets HYPERFINE_RANDOMIZED_ENVIRONMENT_OFFSET for each iteration
];

function isExcludedEnvVar(key: string): boolean {
  return (
    DAEMON_ENV_VARS_EXCLUSIONS.has(key) ||
    DAEMON_ENV_PREFIX_EXCLUSIONS.some((prefix) => key.startsWith(prefix))
  );
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
 * Without the deletion step, a var set by one client (e.g.
 * `NX_PREFER_NODE_STRIP_TYPES=true` or `JAVA_TOOL_OPTIONS=...` for a single
 * command) would persist in the daemon and leak into every subsequent
 * client's project-graph computation. Deletion skips excluded vars and
 * required settings, which the daemon owns and clients should not control.
 */
export function applyDaemonEnvFromClient(newEnv: NodeJS.ProcessEnv): boolean {
  let changed = false;
  const allKeys = new Set([
    ...Object.keys(process.env),
    ...Object.keys(newEnv),
  ]);
  for (const key of allKeys) {
    if (key in newEnv) {
      if (process.env[key] !== newEnv[key]) {
        process.env[key] = newEnv[key];
        changed = true;
      }
    } else if (
      !isExcludedEnvVar(key) &&
      !Object.hasOwn(DAEMON_ENV_REQUIRED_SETTINGS, key)
    ) {
      delete process.env[key];
      changed = true;
    }
  }
  return changed;
}
