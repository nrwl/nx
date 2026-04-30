import { translateOnboardPayload } from './agentic-onboard';

describe('translateOnboardPayload (CNW)', () => {
  it('returns null for empty/whitespace lines', () => {
    expect(translateOnboardPayload('')).toBeNull();
    expect(translateOnboardPayload('   ')).toBeNull();
  });

  it('returns null for non-JSON noise', () => {
    expect(translateOnboardPayload('Building...')).toBeNull();
  });

  it('returns null for progress-only payloads', () => {
    expect(
      translateOnboardPayload('{"stage":"detecting","message":"Repo scan"}')
    ).toBeNull();
  });

  it('maps connected payloads (flat shape)', () => {
    const result = translateOnboardPayload(
      '{"nxCloudId":"id-1","nxCloudUrl":"https://cloud.nx.app/x"}'
    );
    expect(result).toMatchObject({
      status: 'connected',
      nxCloudId: 'id-1',
      nxCloudUrl: 'https://cloud.nx.app/x',
      verifyCommand: 'npx nx-cloud onboard status',
    });
    expect((result as any).nextSteps).toBeDefined();
  });

  it('maps the ocean success payload (workspace.nxCloudId nested)', () => {
    const result = translateOnboardPayload(
      JSON.stringify({
        success: true,
        workspace: {
          id: 'ws_1',
          nxCloudId: 'id-1',
          overviewUrl: 'https://cloud.nx.app/orgs/o/workspaces/ws_1',
        },
        configWritten: true,
      })
    );
    expect(result).toMatchObject({
      status: 'connected',
      nxCloudId: 'id-1',
      nxCloudUrl: 'https://cloud.nx.app/orgs/o/workspaces/ws_1',
      verifyCommand: 'npx nx-cloud onboard status',
    });
    expect((result as any).nextSteps).toBeDefined();
  });

  it('maps github_oauth (object actionRequired) with deviceCode spliced into poll command', () => {
    const result = translateOnboardPayload(
      JSON.stringify({
        success: false,
        actionRequired: {
          type: 'github_oauth',
          deviceCode: 'abc123',
          userCode: 'WXYZ-1234',
          verificationUri: 'https://github.com/login/device',
          message: 'GitHub not connected.',
        },
      })
    );
    expect(result).toMatchObject({
      status: 'needs_input',
      actionRequired: 'github_oauth',
      nextCommand:
        'npx nx-cloud onboard connect github poll --device-code abc123',
      verificationUri: 'https://github.com/login/device',
      userCode: 'WXYZ-1234',
    });
  });

  it('maps login_required (string actionRequired)', () => {
    expect(
      translateOnboardPayload('{"actionRequired":"login_required"}')
    ).toMatchObject({
      status: 'needs_input',
      actionRequired: 'login_required',
      nextCommand: 'npx nx login',
    });
  });

  it('maps explicit error payloads', () => {
    expect(
      translateOnboardPayload(
        '{"status":"error","error":"boom","errorCode":"FOO"}'
      )
    ).toEqual({ status: 'error', code: 'FOO', message: 'boom' });
  });

  it('returns null for unrecognized payloads', () => {
    expect(translateOnboardPayload('{"foo":"bar"}')).toBeNull();
  });
});
