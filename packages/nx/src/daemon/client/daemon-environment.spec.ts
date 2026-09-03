import {
  applyDaemonEnvFromClient,
  getAppliedDaemonClientEnv,
  getDaemonClientEnvGeneration,
  getDaemonEnv,
  getDaemonSpawnEnv,
  hashDaemonClientEnv,
} from './daemon-environment';

describe('daemon environment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getDaemonEnv', () => {
    it('should exclude volatile shell-integration vars', () => {
      process.env.ATUIN_HISTORY_ID = '0192d4d5-uuid-per-command';
      process.env.ATUIN_SESSION = '0192d4d5-uuid-per-shell';
      process.env.STARSHIP_SESSION_KEY = '1234567890123456';
      process.env.STARSHIP_START_TIME = '1754990000000';
      process.env.MCFLY_SESSION_ID = 'random-per-shell';
      process.env.DIRENV_DIFF = 'per-directory-state';
      process.env.__MISE_SESSION = 'per-shell-session';
      process.env.__MISE_DIFF = 'per-hook-env-run';
      process.env.FNM_MULTISHELL_PATH = '/tmp/fnm_multishells/1234_5678';
      process.env.POSH_SESSION_ID = 'per-shell-session';
      process.env.MISE_SHELL = 'zsh';

      const env = getDaemonEnv();

      expect(env.ATUIN_HISTORY_ID).toBeUndefined();
      expect(env.ATUIN_SESSION).toBeUndefined();
      expect(env.STARSHIP_SESSION_KEY).toBeUndefined();
      expect(env.STARSHIP_START_TIME).toBeUndefined();
      expect(env.MCFLY_SESSION_ID).toBeUndefined();
      expect(env.DIRENV_DIFF).toBeUndefined();
      expect(env.__MISE_SESSION).toBeUndefined();
      expect(env.__MISE_DIFF).toBeUndefined();
      expect(env.FNM_MULTISHELL_PATH).toBeUndefined();
      expect(env.POSH_SESSION_ID).toBeUndefined();
      expect(env.MISE_SHELL).toBeUndefined();
    });

    it('should exclude per-directory and per-invocation vars', () => {
      process.env.PWD = '/some/project/subdir';
      process.env.INIT_CWD = '/some/project/subdir';
      process.env.COLOR = '1';

      const env = getDaemonEnv();

      expect(env.PWD).toBeUndefined();
      expect(env.INIT_CWD).toBeUndefined();
      expect(env.COLOR).toBeUndefined();
    });

    it('should exclude terminal identification vars', () => {
      process.env.TERM = 'xterm-ghostty';
      process.env.TERM_PROGRAM = 'vscode';
      process.env.TERM_PROGRAM_VERSION = '1.103.0';
      process.env.COLORTERM = 'truecolor';
      process.env.COLORFGBG = '15;0';
      process.env.VTE_VERSION = '7802';
      process.env.GNOME_TERMINAL_SCREEN = '/org/gnome/Terminal/screen/uuid';
      process.env.GNOME_TERMINAL_SERVICE = ':1.123';
      process.env.WT_SESSION = 'guid-per-tab';
      process.env.WT_PROFILE_ID = 'profile-guid';
      process.env.GHOSTTY_RESOURCES_DIR = '/Applications/Ghostty.app/resources';
      process.env.TERMINAL_EMULATOR = 'JetBrains-JediTerm';
      process.env.TERMINUS_SUBLIME = '1';
      process.env.ConEmuTask = '{cmd::Cmder}';
      process.env.ZELLIJ_PANE_ID = '3';
      process.env.LC_TERMINAL = 'iTerm2';
      process.env.LC_TERMINAL_VERSION = '3.5.0';

      const env = getDaemonEnv();

      expect(env.TERM).toBeUndefined();
      expect(env.TERM_PROGRAM).toBeUndefined();
      expect(env.TERM_PROGRAM_VERSION).toBeUndefined();
      expect(env.COLORTERM).toBeUndefined();
      expect(env.COLORFGBG).toBeUndefined();
      expect(env.VTE_VERSION).toBeUndefined();
      expect(env.GNOME_TERMINAL_SCREEN).toBeUndefined();
      expect(env.GNOME_TERMINAL_SERVICE).toBeUndefined();
      expect(env.WT_SESSION).toBeUndefined();
      expect(env.WT_PROFILE_ID).toBeUndefined();
      expect(env.GHOSTTY_RESOURCES_DIR).toBeUndefined();
      expect(env.TERMINAL_EMULATOR).toBeUndefined();
      expect(env.TERMINUS_SUBLIME).toBeUndefined();
      expect(env.ConEmuTask).toBeUndefined();
      expect(env.ZELLIJ_PANE_ID).toBeUndefined();
      expect(env.LC_TERMINAL).toBeUndefined();
      expect(env.LC_TERMINAL_VERSION).toBeUndefined();
    });

    it('should exclude vars injected by VS Code and its extensions', () => {
      process.env.ELECTRON_RUN_AS_NODE = '1';
      process.env.ELECTRON_NO_ASAR = '1';
      process.env.CHROME_CRASHPAD_PIPE_NAME = '\\\\.\\pipe\\crashpad_21788_x';
      process.env.COPILOT_OTEL_FILE_EXPORTER_PATH = '/tmp/copilot-otel';
      process.env.COPILOT_DEBUG_NONCE = 'per-session-nonce';
      process.env.MXC_BIN_DIR = '/path/to/extension/bin';
      process.env.APPLICATION_INSIGHTS_NO_STATSBEAT = 'true';
      process.env.GIT_ASKPASS = '/vscode/extensions/git/askpass.sh';
      process.env.GIT_EDITOR = 'code --wait';
      process.env.GIT_PAGER = 'cat';
      process.env.GIT_MERGE_AUTOEDIT = 'no';

      const env = getDaemonEnv();

      expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined();
      expect(env.ELECTRON_NO_ASAR).toBeUndefined();
      expect(env.CHROME_CRASHPAD_PIPE_NAME).toBeUndefined();
      expect(env.COPILOT_OTEL_FILE_EXPORTER_PATH).toBeUndefined();
      expect(env.COPILOT_DEBUG_NONCE).toBeUndefined();
      expect(env.MXC_BIN_DIR).toBeUndefined();
      expect(env.APPLICATION_INSIGHTS_NO_STATSBEAT).toBeUndefined();
      expect(env.GIT_ASKPASS).toBeUndefined();
      expect(env.GIT_EDITOR).toBeUndefined();
      expect(env.GIT_PAGER).toBeUndefined();
      expect(env.GIT_MERGE_AUTOEDIT).toBeUndefined();
    });

    it('should exclude pid-shaped EFC_ vars but keep other EFC_-prefixed vars', () => {
      process.env.EFC_16880 = '1';
      process.env.EFC_16880_4126798990 = '1';
      process.env.EFC_PROJECT_MODE = 'strict';

      const env = getDaemonEnv();

      expect(env.EFC_16880).toBeUndefined();
      expect(env.EFC_16880_4126798990).toBeUndefined();
      expect(env.EFC_PROJECT_MODE).toBe('strict');
    });

    it('should exclude output-presentation vars', () => {
      process.env.PAGER = 'less';
      process.env.FORCE_COLOR = '0';
      process.env.NO_COLOR = '1';
      process.env.NODE_DISABLE_COLORS = '1';
      process.env.FORCE_HYPERLINK = '1';
      process.env.NX_ORIGINAL_FORCE_COLOR = '0';

      const env = getDaemonEnv();

      expect(env.PAGER).toBeUndefined();
      expect(env.FORCE_COLOR).toBeUndefined();
      expect(env.NO_COLOR).toBeUndefined();
      expect(env.NODE_DISABLE_COLORS).toBeUndefined();
      expect(env.FORCE_HYPERLINK).toBeUndefined();
      expect(env.NX_ORIGINAL_FORCE_COLOR).toBeUndefined();
    });

    it('should exclude editor preference vars', () => {
      process.env.EDITOR = 'vim';
      process.env.VISUAL = 'code --wait';

      const env = getDaemonEnv();

      expect(env.EDITOR).toBeUndefined();
      expect(env.VISUAL).toBeUndefined();
    });

    it('should exclude AI agent vars', () => {
      process.env.AI_AGENT = 'claude-code_2-1-228_agent';
      process.env.CODEX_THREAD_ID = 'per-session-id';
      process.env.CLAUDE_CODE_SESSION_ID = 'per-session-uuid';

      const env = getDaemonEnv();

      expect(env.AI_AGENT).toBeUndefined();
      expect(env.CODEX_THREAD_ID).toBeUndefined();
      expect(env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
    });

    it('should exclude Nx CLI mechanics vars', () => {
      process.env.NX_CLI_SET = 'true';
      process.env.NX_WORKSPACE_ROOT_PATH = '/workspace/root';
      process.env.PROMPT = '$P$G';

      const env = getDaemonEnv();

      expect(env.NX_CLI_SET).toBeUndefined();
      expect(env.NX_WORKSPACE_ROOT_PATH).toBeUndefined();
      expect(env.PROMPT).toBeUndefined();
    });

    it('should keep vars that can affect the project graph', () => {
      process.env.PATH = '/usr/bin:/bin';
      process.env.JAVA_HOME = '/opt/java';
      process.env.GRADLE_HOME = '/opt/gradle';
      // deliberately not covered by GIT_/CHROME_/FNM_ prefix exclusions
      process.env.GIT_DIR = '/custom/.git';
      process.env.CHROME_BIN = '/usr/bin/chromium';
      process.env.FNM_DIR = '/home/user/.fnm';
      process.env.NVM_BIN = '/home/user/.nvm/versions/node/v22.0.0/bin';
      process.env.MISE_ENV = 'production';
      // functional Copilot CLI config; deliberately no COPILOT_ prefix exclusion
      process.env.COPILOT_HOME = '/home/user/.copilot';
      process.env.COPILOT_GITHUB_TOKEN = 'token';

      const env = getDaemonEnv();

      expect(env.PATH).toBe('/usr/bin:/bin');
      expect(env.JAVA_HOME).toBe('/opt/java');
      expect(env.GRADLE_HOME).toBe('/opt/gradle');
      expect(env.GIT_DIR).toBe('/custom/.git');
      expect(env.CHROME_BIN).toBe('/usr/bin/chromium');
      expect(env.FNM_DIR).toBe('/home/user/.fnm');
      expect(env.NVM_BIN).toBe('/home/user/.nvm/versions/node/v22.0.0/bin');
      expect(env.MISE_ENV).toBe('production');
      expect(env.COPILOT_HOME).toBe('/home/user/.copilot');
      expect(env.COPILOT_GITHUB_TOKEN).toBe('token');
    });

    it('should keep the Nx Cloud auth tokens despite the NX_CLOUD_ prefix exclusion', () => {
      process.env.NX_CLOUD_ACCESS_TOKEN = 'token';
      process.env.NX_CLOUD_AUTH_TOKEN = 'token';
      process.env.NX_CLOUD_WORKER_ID = 'worker-1';

      const env = getDaemonEnv();

      expect(env.NX_CLOUD_ACCESS_TOKEN).toBe('token');
      expect(env.NX_CLOUD_AUTH_TOKEN).toBe('token');
      expect(env.NX_CLOUD_WORKER_ID).toBeUndefined();
    });

    it('should apply the required and overridable daemon settings', () => {
      process.env.NX_PROJECT_GLOB_CACHE = 'true';
      delete process.env.NX_VERBOSE_LOGGING;

      const env = getDaemonEnv();

      expect(env.NX_PROJECT_GLOB_CACHE).toBe('false');
      expect(env.NX_CACHE_PROJECTS_CONFIG).toBe('false');
      expect(env.NX_VERBOSE_LOGGING).toBe('true');
    });
  });

  describe('getDaemonSpawnEnv', () => {
    it('should keep ELECTRON_RUN_AS_NODE so an Electron execPath still runs the daemon entry point', () => {
      process.env.ELECTRON_RUN_AS_NODE = '1';
      process.env.ELECTRON_NO_ASAR = '1';

      const env = getDaemonSpawnEnv();

      expect(env.ELECTRON_RUN_AS_NODE).toBe('1');
      // the rest of the reflected filter still applies
      expect(env.ELECTRON_NO_ASAR).toBeUndefined();
    });

    it('should not add ELECTRON_RUN_AS_NODE when the client does not have it', () => {
      delete process.env.ELECTRON_RUN_AS_NODE;

      expect('ELECTRON_RUN_AS_NODE' in getDaemonSpawnEnv()).toBe(false);
    });

    it('should keep NX_WORKSPACE_ROOT_PATH so the daemon starts with the pinned workspace root', () => {
      process.env.NX_WORKSPACE_ROOT_PATH = '/workspace/root';

      const env = getDaemonSpawnEnv();

      expect(env.NX_WORKSPACE_ROOT_PATH).toBe('/workspace/root');
      // still excluded from the reflected env
      expect(getDaemonEnv().NX_WORKSPACE_ROOT_PATH).toBeUndefined();
    });

    it('should not add NX_WORKSPACE_ROOT_PATH when the client does not have it', () => {
      delete process.env.NX_WORKSPACE_ROOT_PATH;

      expect('NX_WORKSPACE_ROOT_PATH' in getDaemonSpawnEnv()).toBe(false);
    });

    it('should keep NX_MAX_MESSAGE_SIZE so the daemon starts with the spawning client message limit', () => {
      process.env.NX_MAX_MESSAGE_SIZE = '1048576';

      expect(getDaemonSpawnEnv().NX_MAX_MESSAGE_SIZE).toBe('1048576');
      // not reflected: a later client's value must not govern another
      // client's connection, whose parser reads the limit before any client
      // env is applied
      expect(getDaemonEnv().NX_MAX_MESSAGE_SIZE).toBeUndefined();
    });

    it('should not add NX_MAX_MESSAGE_SIZE when the client does not have it', () => {
      delete process.env.NX_MAX_MESSAGE_SIZE;

      expect('NX_MAX_MESSAGE_SIZE' in getDaemonSpawnEnv()).toBe(false);
    });
  });

  describe('applyDaemonEnvFromClient', () => {
    it('should report changed and deleted vars', () => {
      process.env.FOO = 'old';
      process.env.BAR = 'gone';

      const changed = applyDaemonEnvFromClient({ FOO: 'new' });

      expect(changed).toContain('FOO');
      expect(changed).toContain('BAR');
      expect(process.env.FOO).toBe('new');
      expect(process.env.BAR).toBeUndefined();
    });

    it('should not delete or report excluded vars missing from the client env', () => {
      process.env.ATUIN_SESSION = 'daemon-startup-value';
      process.env.TERM_PROGRAM = 'ghostty';

      const changed = applyDaemonEnvFromClient({});

      expect(changed).not.toContain('ATUIN_SESSION');
      expect(changed).not.toContain('TERM_PROGRAM');
      expect(process.env.ATUIN_SESSION).toBe('daemon-startup-value');
      expect(process.env.TERM_PROGRAM).toBe('ghostty');
    });

    it('should keep the spawn-time NX_MAX_MESSAGE_SIZE across clients that do not set it', () => {
      process.env.NX_MAX_MESSAGE_SIZE = '1048576';

      const changed = applyDaemonEnvFromClient({});

      expect(changed).not.toContain('NX_MAX_MESSAGE_SIZE');
      expect(process.env.NX_MAX_MESSAGE_SIZE).toBe('1048576');
    });

    it('should converge after one application of a client env payload', () => {
      process.env.ATUIN_SESSION = 'daemon-startup-value';
      process.env.JAVA_HOME = '/opt/java-client';
      // isolate the payload from the developer's shell
      delete process.env.JAVA_TOOL_OPTIONS;
      const payload = getDaemonEnv();
      applyDaemonEnvFromClient(payload);

      // simulate daemon-side drift from a previous client
      process.env.JAVA_HOME = '/opt/java-daemon';
      process.env.JAVA_TOOL_OPTIONS = '-Xmx1g';

      const first = applyDaemonEnvFromClient(payload);

      expect([...first].sort()).toEqual(['JAVA_HOME', 'JAVA_TOOL_OPTIONS']);
      expect(process.env.JAVA_HOME).toBe('/opt/java-client');
      expect(process.env.JAVA_TOOL_OPTIONS).toBeUndefined();
      expect(process.env.ATUIN_SESSION).toBe('daemon-startup-value');
      expect(applyDaemonEnvFromClient(payload)).toEqual([]);
    });

    it('should not delete required settings missing from the client env', () => {
      process.env.NX_PROJECT_GLOB_CACHE = 'false';
      process.env.NX_CACHE_PROJECTS_CONFIG = 'false';

      // baseline the applied client env so only FOO is reported below
      const base = { ...process.env };
      delete base.NX_PROJECT_GLOB_CACHE;
      delete base.NX_CACHE_PROJECTS_CONFIG;
      applyDaemonEnvFromClient(base);
      const changed = applyDaemonEnvFromClient({ ...base, FOO: 'bar' });

      expect(changed).toEqual(['FOO']);
      expect(process.env.NX_PROJECT_GLOB_CACHE).toBe('false');
      expect(process.env.NX_CACHE_PROJECTS_CONFIG).toBe('false');
    });

    it('should turn on the overridable logging settings on the daemon', () => {
      process.env.NX_VERBOSE_LOGGING = 'false';

      const changed = applyDaemonEnvFromClient(getDaemonEnv());

      expect(changed).toContain('NX_VERBOSE_LOGGING');
      expect(process.env.NX_VERBOSE_LOGGING).toBe('true');
    });

    it('should apply and delete the Nx Cloud auth tokens like any forwarded var', () => {
      // baseline the applied client env so only the token is reported below
      applyDaemonEnvFromClient({ ...process.env });
      const added = applyDaemonEnvFromClient({
        ...process.env,
        NX_CLOUD_ACCESS_TOKEN: 'token',
      });
      expect(added).toEqual(['NX_CLOUD_ACCESS_TOKEN']);
      expect(process.env.NX_CLOUD_ACCESS_TOKEN).toBe('token');

      const clientEnvWithoutToken = { ...process.env };
      delete clientEnvWithoutToken.NX_CLOUD_ACCESS_TOKEN;
      const deleted = applyDaemonEnvFromClient(clientEnvWithoutToken);
      expect(deleted).toEqual(['NX_CLOUD_ACCESS_TOKEN']);
      expect(process.env.NX_CLOUD_ACCESS_TOKEN).toBeUndefined();
    });
  });

  // NX_LOAD_DOT_ENV_FILES must reach the daemon so createNodes resolves task
  // dotenv the way the task will, and so the user's 'false' opt-out is honored
  // at graph-construction time. It reads like a task-scoped var that cannot
  // affect the graph, so guard against it being re-added to the exclusions.
  describe('NX_LOAD_DOT_ENV_FILES', () => {
    it('is forwarded to the daemon env', () => {
      process.env.NX_LOAD_DOT_ENV_FILES = 'false';
      expect(getDaemonEnv().NX_LOAD_DOT_ENV_FILES).toBe('false');
    });

    it('is cleared when a later client omits it (last-client-wins)', () => {
      // Or the new client's graph would run with the previous client's opt-out.
      process.env.NX_LOAD_DOT_ENV_FILES = 'false';
      const changed = applyDaemonEnvFromClient({});
      expect(process.env.NX_LOAD_DOT_ENV_FILES).toBeUndefined();
      expect(changed).toContain('NX_LOAD_DOT_ENV_FILES');
    });

    it('is sent as its meaning, so an unset shell and a stamped task child agree', () => {
      delete process.env.NX_LOAD_DOT_ENV_FILES;
      expect(getDaemonEnv().NX_LOAD_DOT_ENV_FILES).toBe('true');
      // run-command stamps 'true' once the graph exists and task children
      // inherit it; sending that spelling would read as an env change.
      process.env.NX_LOAD_DOT_ENV_FILES = 'true';
      expect(getDaemonEnv().NX_LOAD_DOT_ENV_FILES).toBe('true');
    });

    it('reports no change as a run alternates between the two spellings', () => {
      // `nx build`, then a task child carrying the stamp, then `nx show`.
      // getDaemonEnv reads the client's env while applyDaemonEnvFromClient
      // writes the daemon's, so swap the client value in only for the send.
      const send = (shellValue: string | undefined) => {
        const daemonValue = process.env.NX_LOAD_DOT_ENV_FILES;
        if (shellValue === undefined) delete process.env.NX_LOAD_DOT_ENV_FILES;
        else process.env.NX_LOAD_DOT_ENV_FILES = shellValue;
        const sent = getDaemonEnv() as Record<string, string>;
        if (daemonValue === undefined) delete process.env.NX_LOAD_DOT_ENV_FILES;
        else process.env.NX_LOAD_DOT_ENV_FILES = daemonValue;
        return sent;
      };

      applyDaemonEnvFromClient(send(undefined));
      expect(applyDaemonEnvFromClient(send('true'))).not.toContain(
        'NX_LOAD_DOT_ENV_FILES'
      );
      expect(applyDaemonEnvFromClient(send(undefined))).not.toContain(
        'NX_LOAD_DOT_ENV_FILES'
      );
      // A genuine opt-out is still a change.
      expect(applyDaemonEnvFromClient(send('false'))).toContain(
        'NX_LOAD_DOT_ENV_FILES'
      );
    });
  });

  describe('getDaemonClientEnvGeneration', () => {
    it('moves only when an apply changes the env', () => {
      const base = getDaemonClientEnvGeneration();
      const withProbe = { ...process.env, GEN_PROBE: 'a' };
      applyDaemonEnvFromClient(withProbe);
      expect(getDaemonClientEnvGeneration()).toBe(base + 1);
      // The same env again changes nothing, so the count must hold: a pass
      // spanning only no-op applies must still be allowed to persist.
      applyDaemonEnvFromClient(withProbe);
      expect(getDaemonClientEnvGeneration()).toBe(base + 1);
    });
  });

  describe('applyDaemonEnvFromClient', () => {
    it('reports a client change that process.env already matches', () => {
      // A config the daemon evaluated wrote the value the next client sends,
      // so process.env has nothing to move on; the client-owned env did move
      // and the graph computed under the previous client is stale.
      const previous = { ...process.env };
      applyDaemonEnvFromClient(previous);
      process.env.MASKED_PROBE = 'from-config';
      const generation = getDaemonClientEnvGeneration();

      const changed = applyDaemonEnvFromClient({
        ...previous,
        MASKED_PROBE: 'from-config',
      });

      expect(changed).toEqual(['MASKED_PROBE']);
      expect(getDaemonClientEnvGeneration()).toBe(generation + 1);
    });
  });

  describe('getAppliedDaemonClientEnv', () => {
    it('returns a copy of the last applied env, whether or not it changed anything', () => {
      const applied = { ...process.env, APPLIED_PROBE: 'a' };
      applyDaemonEnvFromClient(applied);
      expect(getAppliedDaemonClientEnv().env).toEqual(applied);
      // A no-op apply is still the last one applied.
      applyDaemonEnvFromClient(applied);
      const copy = getAppliedDaemonClientEnv().env;
      expect(copy).toEqual(applied);
      // A caller mutating the copy must not touch the stored env, which a
      // later caller reads to undo what a user config wrote.
      copy.APPLIED_PROBE = 'mutated';
      expect(getAppliedDaemonClientEnv().env.APPLIED_PROBE).toBe('a');
    });

    it('advances the sequence on an apply that changes nothing, unlike the generation', () => {
      // A config that already wrote the value a client then applies leaves
      // the generation alone; the sequence is how a caller learns the apply
      // happened at all.
      const applied = { ...process.env, APPLIED_PROBE: 'a' };
      applyDaemonEnvFromClient(applied);
      const { sequence } = getAppliedDaemonClientEnv();
      const generation = getDaemonClientEnvGeneration();
      expect(applyDaemonEnvFromClient(applied)).toEqual([]);
      expect(getDaemonClientEnvGeneration()).toBe(generation);
      expect(getAppliedDaemonClientEnv().sequence).toBe(sequence + 1);
    });
  });

  describe('hashDaemonClientEnv', () => {
    it('changes when an allowed env var changes value, appears, or disappears', () => {
      delete process.env.SOME_TOOL_HOME;
      const without = hashDaemonClientEnv();
      process.env.SOME_TOOL_HOME = '/usr/lib/tool';
      const withVar = hashDaemonClientEnv();
      expect(withVar).not.toEqual(without);
      process.env.SOME_TOOL_HOME = '/opt/tool';
      expect(hashDaemonClientEnv()).not.toEqual(withVar);
      delete process.env.SOME_TOOL_HOME;
      expect(hashDaemonClientEnv()).toEqual(without);
    });

    it('is stable across the two NX_LOAD_DOT_ENV_FILES spellings that mean the same', () => {
      // The digest keys the plugin cache, so it has to collapse the stamped
      // 'true' and an unset value exactly as getDaemonEnv does.
      delete process.env.NX_LOAD_DOT_ENV_FILES;
      const unset = hashDaemonClientEnv();
      process.env.NX_LOAD_DOT_ENV_FILES = 'true';
      expect(hashDaemonClientEnv()).toEqual(unset);
      process.env.NX_LOAD_DOT_ENV_FILES = 'false';
      expect(hashDaemonClientEnv()).not.toEqual(unset);
    });

    it('is stable when an excluded env var changes', () => {
      delete process.env.NX_TUI;
      delete process.env.ITERM_SESSION_ID;
      const base = hashDaemonClientEnv();
      process.env.NX_TUI = 'true';
      process.env.ITERM_SESSION_ID = 'w0t1p0:12345';
      expect(hashDaemonClientEnv()).toEqual(base);
    });

    it('changes when a prefix-exclusion override changes', () => {
      delete process.env.NX_CLOUD_ACCESS_TOKEN;
      const base = hashDaemonClientEnv();
      process.env.NX_CLOUD_ACCESS_TOKEN = 'token';
      expect(hashDaemonClientEnv()).not.toEqual(base);
    });

    // The daemon pins the required settings into its own and every plugin
    // worker's env while daemonless plugin workers typically lack them;
    // skipping them keeps the digest identical across modes.
    it('is stable when a required daemon setting changes', () => {
      delete process.env.NX_PROJECT_GLOB_CACHE;
      const base = hashDaemonClientEnv();
      process.env.NX_PROJECT_GLOB_CACHE = 'false';
      expect(hashDaemonClientEnv()).toEqual(base);
    });

    // Pins that the overridable settings need no dedicated skip like the
    // required ones above: they are already in the exclusion set.
    it('is stable when an overridable daemon setting changes', () => {
      delete process.env.NX_VERBOSE_LOGGING;
      const base = hashDaemonClientEnv();
      process.env.NX_VERBOSE_LOGGING = 'true';
      expect(hashDaemonClientEnv()).toEqual(base);
    });
  });
});
