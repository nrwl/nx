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

  it('maps the ocean success payload (workspace.nxCloudId nested)', () => {
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
    expect((result as any).nextSteps.steps.join(' ')).toMatch(/twice|cache/i);
  });

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
    expect(translateOnboardPayload('{"nxCloudId":"xyz"}')).toMatchObject({
      status: 'connected',
      nxCloudId: 'xyz',
      nxCloudUrl: undefined,
      verifyCommand: 'npx nx-cloud onboard status',
    });
  });

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
      message: expect.stringContaining('GitHub not connected'),
    });
    expect((result as any).hint).toContain('single-shot');
    expect((result as any).hint).toContain('connect-workspace');
  });

  it('maps github_app_install (object actionRequired) with no nextCommand and the install URL', () => {
    expect(
      translateOnboardPayload(
        JSON.stringify({
          success: false,
          error:
            'Repository "nrwl-jack/test" not found. Make sure the GitHub App has access to this repository.',
          actionRequired: {
            type: 'github_app_install',
            message: 'The GitHub App may not have access to this repository.',
            url: 'https://github.com/apps/nx-cloud/installations/new',
          },
        })
      )
    ).toMatchObject({
      status: 'needs_input',
      actionRequired: 'github_app_install',
      nextCommand: '',
      verificationUri: 'https://github.com/apps/nx-cloud/installations/new',
      hint: expect.stringContaining('install'),
    });
  });

  it('maps login_required (string actionRequired) to npx nx login', () => {
    expect(
      translateOnboardPayload('{"actionRequired":"login_required"}')
    ).toMatchObject({
      status: 'needs_input',
      actionRequired: 'login_required',
      nextCommand: 'npx nx login',
    });
  });

  it('preserves unknown actions and surfaces payload.message verbatim', () => {
    expect(
      translateOnboardPayload(
        JSON.stringify({
          actionRequired: { type: 'some_future_action' },
          message: 'Do the new thing',
        })
      )
    ).toMatchObject({
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

  it('maps the multi-org disambiguation error payload', () => {
    expect(
      translateOnboardPayload(
        JSON.stringify({
          success: false,
          error:
            'Multiple organizations available. Please specify one with --org. Available: foo (id1), bar (id2)',
        })
      )
    ).toMatchObject({
      status: 'error',
      code: 'ONBOARD_ERROR',
      message: expect.stringContaining('Multiple organizations'),
    });
  });

  it('maps the 409 workspace-already-exists payload to a needs_input pointing at status', () => {
    expect(
      translateOnboardPayload(
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
      )
    ).toMatchObject({
      status: 'needs_input',
      actionRequired: 'workspace_already_exists',
      nextCommand: 'npx nx-cloud onboard status',
      hint: expect.stringContaining('nx.json'),
    });
  });

  it('returns null for unrecognized terminal payloads', () => {
    expect(translateOnboardPayload('{"random":"shape"}')).toBeNull();
    expect(translateOnboardPayload('{"nxCloudId":""}')).toBeNull();
  });

  it('handles a multi-line pretty-printed JSON blob', () => {
    const blob = `{
  "success": false,
  "actionRequired": {
    "type": "github_oauth",
    "deviceCode": "abc123",
    "userCode": "WXYZ-1234",
    "verificationUri": "https://github.com/login/device"
  }
}`;
    expect(translateOnboardPayload(blob)).toMatchObject({
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
