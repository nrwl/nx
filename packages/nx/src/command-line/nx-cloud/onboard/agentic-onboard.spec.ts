import { extractJsonObject, translateOnboardPayload } from './agentic-onboard';

describe('translateOnboardPayload', () => {
  it('returns null for empty or whitespace lines', () => {
    expect(translateOnboardPayload('')).toBeNull();
    expect(translateOnboardPayload('   \n')).toBeNull();
  });

  it('returns null for non-JSON lines (human-readable noise)', () => {
    expect(translateOnboardPayload('Connecting to Nx Cloud...')).toBeNull();
    expect(translateOnboardPayload('> some shell output')).toBeNull();
  });

  it('returns null for progress messages so they do not terminate the stream', () => {
    expect(
      translateOnboardPayload(
        '{"stage":"configuring","message":"Detecting repo..."}'
      )
    ).toBeNull();
    expect(
      translateOnboardPayload(
        '{"stage":"creating-workspace","message":"Creating workspace"}'
      )
    ).toBeNull();
  });

  // Ocean's `connect-workspace --json` success payload: nxCloudId nested under `workspace`.
  it('maps the ocean success payload (workspace.nxCloudId, success: true)', () => {
    const result = translateOnboardPayload(
      JSON.stringify({
        success: true,
        workspace: {
          id: 'ws_1',
          name: 'my-workspace',
          nxCloudId: 'abc123',
          orgId: 'org_1',
          overviewUrl: 'https://cloud.nx.app/orgs/org_1/workspaces/ws_1',
        },
        configWritten: true,
      })
    );
    expect(result).toMatchObject({
      status: 'connected',
      nxCloudId: 'abc123',
      nxCloudUrl: 'https://cloud.nx.app/orgs/org_1/workspaces/ws_1',
      verifyCommand: 'npx nx-cloud onboard status',
    });
    // Connected results carry next-steps the agent uses to guide the user
    // through a cache-replay demo.
    expect((result as any).nextSteps.steps.join(' ')).toMatch(/twice|cache/i);
  });

  // Legacy / direct callers may still emit the flat shape.
  it('maps a flat connected payload (top-level nxCloudId)', () => {
    const result = translateOnboardPayload(
      '{"nxCloudId":"abc123","nxCloudUrl":"https://cloud.nx.app/orgs/o/workspaces/w"}'
    );
    expect(result).toMatchObject({
      status: 'connected',
      nxCloudId: 'abc123',
      nxCloudUrl: 'https://cloud.nx.app/orgs/o/workspaces/w',
      verifyCommand: 'npx nx-cloud onboard status',
    });
    expect((result as any).nextSteps).toBeDefined();
  });

  it('maps connected payload without nxCloudUrl', () => {
    const result = translateOnboardPayload('{"nxCloudId":"xyz"}');
    expect(result).toMatchObject({
      status: 'connected',
      nxCloudId: 'xyz',
      nxCloudUrl: undefined,
      verifyCommand: 'npx nx-cloud onboard status',
    });
    expect((result as any).nextSteps).toBeDefined();
  });

  // Ocean's `actionRequired` is an object with `type`, not a bare string.
  // The translator must splice the deviceCode into the poll command so the
  // agent has a complete next command.
  it('maps github_oauth (object actionRequired) with deviceCode spliced into poll command', () => {
    const result = translateOnboardPayload(
      JSON.stringify({
        success: false,
        actionRequired: {
          type: 'github_oauth',
          message:
            'GitHub not connected. Please visit https://github.com/login/device and enter code: 6810-5F25',
          url: 'https://github.com/login/device',
          deviceCode: '5fad949b2a0dc8f587ef9e1cb8886088bd6eba9f',
          userCode: '6810-5F25',
          verificationUri: 'https://github.com/login/device',
          expiresIn: 899,
          interval: 5,
        },
      })
    );
    expect(result).toMatchObject({
      status: 'needs_input',
      actionRequired: 'github_oauth',
      nextCommand:
        'npx nx-cloud onboard connect github poll --device-code 5fad949b2a0dc8f587ef9e1cb8886088bd6eba9f',
      verificationUri: 'https://github.com/login/device',
      userCode: '6810-5F25',
    });
    expect((result as any).message).toContain('GitHub not connected');
    // Hint must explain that poll is single-shot and direct the agent to
    // advance via connect-workspace after a "complete" poll. nx connect can
    // re-trigger OAuth due to a known backend state lag.
    expect((result as any).hint).toContain('single-shot');
    expect((result as any).hint).toContain('connect-workspace');
    expect((result as any).hint).toContain('complete');
  });

  it('maps github_app_install (object actionRequired) with no nextCommand and the install URL', () => {
    const result = translateOnboardPayload(
      JSON.stringify({
        success: false,
        error:
          'Repository "nrwl-jack/test" not found. Make sure the GitHub App has access to this repository.',
        actionRequired: {
          type: 'github_app_install',
          message:
            'The GitHub App may not have access to this repository. Please check the installation settings.',
          url: 'https://github.com/apps/nx-cloud/installations/new',
        },
      })
    );
    expect(result).toMatchObject({
      status: 'needs_input',
      actionRequired: 'github_app_install',
      nextCommand: '',
      verificationUri: 'https://github.com/apps/nx-cloud/installations/new',
    });
    expect((result as any).hint).toContain('install');
  });

  // Backwards-compatible: bare-string actionRequired (legacy / sentinel callers).
  it('maps login_required (string actionRequired) with the nx login next command', () => {
    const result = translateOnboardPayload(
      '{"actionRequired":"login_required"}'
    );
    expect(result).toMatchObject({
      status: 'needs_input',
      actionRequired: 'login_required',
      nextCommand: 'npx nx login',
    });
  });

  it('preserves unknown actions and surfaces payload.message verbatim', () => {
    const result = translateOnboardPayload(
      JSON.stringify({
        actionRequired: { type: 'some_future_action' },
        message: 'Do the new thing',
      })
    );
    expect(result).toMatchObject({
      status: 'needs_input',
      actionRequired: 'some_future_action',
      message: 'Do the new thing',
      nextCommand: '',
      hint: undefined,
    });
  });

  it('maps explicit error payloads', () => {
    expect(
      translateOnboardPayload(
        '{"status":"error","error":"Token rejected","errorCode":"AUTH_FAILED"}'
      )
    ).toEqual({
      status: 'error',
      code: 'AUTH_FAILED',
      message: 'Token rejected',
    });
  });

  it('maps payloads with only an error string and defaults the code', () => {
    expect(translateOnboardPayload('{"error":"Network unreachable"}')).toEqual({
      status: 'error',
      code: 'ONBOARD_ERROR',
      message: 'Network unreachable',
    });
  });

  // Multi-org disambiguation today: { success: false, error: "Multiple organizations available..." }
  // No actionRequired — falls into the error branch with the helpful message intact.
  it('maps the multi-org disambiguation error payload', () => {
    const result = translateOnboardPayload(
      JSON.stringify({
        success: false,
        error:
          'Multiple organizations available. Please specify one with --org. Available: foo (id1), bar (id2)',
      })
    );
    expect(result).toMatchObject({
      status: 'error',
      code: 'ONBOARD_ERROR',
      message: expect.stringContaining('Multiple organizations'),
    });
  });

  // 409 "Workspace already exists" — re-running connect on an already-connected
  // workspace 409s with a `fix_input` remediation telling the agent to pick a
  // different name. That misleads agents into treating the existing connection
  // as a failure. Translate to needs_input pointing at status check.
  it('maps the 409 workspace-already-exists payload to a needs_input pointing at status', () => {
    const result = translateOnboardPayload(
      JSON.stringify({
        error: true,
        status: 409,
        message: 'Workspace already exists: my-workspace',
        remediation: {
          type: 'fix_input',
          field: 'name',
          message:
            'A workspace with that name already exists. Choose a different name.',
        },
      })
    );
    expect(result).toMatchObject({
      status: 'needs_input',
      actionRequired: 'workspace_already_exists',
      nextCommand: 'npx nx-cloud onboard status',
    });
    expect((result as any).hint).toContain('nx.json');
  });

  it('returns null for unrecognized terminal payloads (caller treats as error)', () => {
    expect(translateOnboardPayload('{"random":"shape"}')).toBeNull();
    expect(translateOnboardPayload('{"nxCloudId":""}')).toBeNull();
  });

  // Regression: ocean emits one pretty-printed JSON object spanning many
  // lines, not NDJSON. The translator must handle the whole blob in one shot
  // — passing an individual line like `{` or `  "success": false,` returns
  // null, which is fine; the wrapper retries with the whole buffer at close.
  it('handles a multi-line pretty-printed JSON blob (the actual bin output)', () => {
    const blob = `{
  "success": false,
  "actionRequired": {
    "type": "github_oauth",
    "deviceCode": "abc123",
    "userCode": "WXYZ-1234",
    "verificationUri": "https://github.com/login/device"
  }
}`;
    const result = translateOnboardPayload(blob);
    expect(result).toMatchObject({
      status: 'needs_input',
      actionRequired: 'github_oauth',
      nextCommand:
        'npx nx-cloud onboard connect github poll --device-code abc123',
    });
  });
});

describe('extractJsonObject', () => {
  it('returns null when there is no JSON object', () => {
    expect(extractJsonObject('')).toBeNull();
    expect(extractJsonObject('just human text, no braces')).toBeNull();
  });

  it('extracts a flat JSON object from a clean buffer', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  // Regression: ocean's success path prints `output.note('Updating nx.json with
  // Nx Cloud ID')` to stdout in --json mode, contaminating the JSON blob with
  // human text. Wrapper has to slice the JSON out.
  it('extracts the JSON blob when preceded by human-readable text', () => {
    const buf = `
 NX   Updating nx.json with Nx Cloud ID

Your nx.json has been updated to use an Nx Cloud ID for authentication.

{
  "success": true,
  "workspace": {
    "id": "abc",
    "nxCloudId": "abc123"
  },
  "configWritten": true
}`;
    const blob = extractJsonObject(buf);
    expect(blob).not.toBeNull();
    expect(JSON.parse(blob!)).toEqual({
      success: true,
      workspace: { id: 'abc', nxCloudId: 'abc123' },
      configWritten: true,
    });
  });

  it('ignores braces inside JSON string values', () => {
    expect(extractJsonObject('{"msg":"hello {world}","ok":true}')).toBe(
      '{"msg":"hello {world}","ok":true}'
    );
  });

  it('handles escaped quotes inside strings without losing brace tracking', () => {
    expect(extractJsonObject('{"a":"a \\"quoted\\" }","b":1}')).toBe(
      '{"a":"a \\"quoted\\" }","b":1}'
    );
  });
});
