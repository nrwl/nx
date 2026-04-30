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

  it('maps connected payloads', () => {
    expect(
      translateOnboardPayload(
        '{"nxCloudId":"id-1","nxCloudUrl":"https://cloud.nx.app/x"}'
      )
    ).toEqual({
      status: 'connected',
      nxCloudId: 'id-1',
      nxCloudUrl: 'https://cloud.nx.app/x',
    });
  });

  it('maps github_auth_needed action', () => {
    expect(
      translateOnboardPayload(
        '{"actionRequired":"github_auth_needed","deviceCode":"X"}'
      )
    ).toMatchObject({
      status: 'needs_input',
      actionRequired: 'github_auth_needed',
      nextCommand: 'npx nx-cloud onboard connect github',
    });
  });

  it('maps login_required action', () => {
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
