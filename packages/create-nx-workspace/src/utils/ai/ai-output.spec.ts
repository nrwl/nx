import {
  buildErrorResult,
  buildSuccessResult,
  writeAiOutput,
} from './ai-output';

describe('buildErrorResult hints', () => {
  it('NETWORK_ERROR points at network/sandbox config and the --preset=empty escape hatch', () => {
    const hints = buildErrorResult('boom', 'NETWORK_ERROR').hints.join('\n');
    expect(hints).toMatch(/sandbox configuration/);
    expect(hints).toMatch(/--preset=empty/);
  });

  it('TEMPLATE_CLONE_FAILED points at the template name and still offers the escape hatch', () => {
    const hints = buildErrorResult('boom', 'TEMPLATE_CLONE_FAILED').hints.join(
      '\n'
    );
    expect(hints).toMatch(/template name/);
    expect(hints).toMatch(/--preset=empty/);
  });

  it('unknown codes fall through to generic hints', () => {
    const hints = buildErrorResult('boom', 'UNKNOWN').hints.join('\n');
    expect(hints).toMatch(/github\.com\/nrwl\/nx\/issues/);
  });
});

describe('success output', () => {
  const options = {
    workspacePath: '/workspaces/my-nx-repo',
    workspaceName: 'my-nx-repo',
    template: 'nrwl/typescript-template',
  };

  beforeEach(() => {
    vi.stubEnv('CLAUDECODE', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('omits next steps and the display block without a Cloud connect URL', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const result = buildSuccessResult(options);

    expect(result).toEqual({
      stage: 'complete',
      success: true,
      result: {
        title: 'Nx Workspace Created Successfully',
        ...options,
      },
      docs: {
        gettingStarted: 'https://nx.dev/getting-started/intro',
        nxCloud: 'https://nx.dev/ci/intro/why-nx-cloud',
      },
    });
    expect(result).not.toHaveProperty('userNextSteps');

    writeAiOutput(result);

    expect(write).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(result) + '\n'
    );
    expect(JSON.parse(write.mock.calls[0][0] as string)).not.toHaveProperty(
      'userNextSteps'
    );
  });

  it('includes next steps and the display block with a Cloud connect URL', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const nxCloudConnectUrl = 'https://cloud.nx.app/connect/example';
    const result = buildSuccessResult({ ...options, nxCloudConnectUrl });

    expect(result.userNextSteps).toEqual({
      description:
        'CRITICAL: Show the user these exact steps to complete setup.',
      steps: [
        {
          title: 'Connect to Nx Cloud (Recommended)',
          url: nxCloudConnectUrl,
          note: 'Complete setup to enable remote caching and CI insights',
        },
      ],
    });

    writeAiOutput(result);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(1, JSON.stringify(result) + '\n');
    expect(write).toHaveBeenNthCalledWith(
      2,
      '\n---USER_NEXT_STEPS---\n' +
        '[DISPLAY] Show the user these next steps to complete setup:\n\n' +
        `1. Connect to Nx Cloud (Recommended): ${nxCloudConnectUrl}\n` +
        '   Complete setup to enable remote caching and CI insights\n' +
        '---END---\n'
    );
  });

  it('omits the display block for explicitly empty next steps', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const result = buildSuccessResult(options);
    result.userNextSteps = { description: 'Show these steps.', steps: [] };

    writeAiOutput(result);

    expect(write).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(result) + '\n'
    );
  });
});
