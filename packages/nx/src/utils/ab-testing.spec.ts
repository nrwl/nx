import { NX_CLOUD_URL, nxCloudHyperlink } from './ab-testing';

describe('nxCloudHyperlink', () => {
  const BEL = '\u0007';
  const OSC = '\u001B]';
  let originalForce: string | undefined;

  beforeEach(() => {
    originalForce = process.env.FORCE_HYPERLINK;
  });

  afterEach(() => {
    if (originalForce === undefined) {
      delete process.env.FORCE_HYPERLINK;
    } else {
      process.env.FORCE_HYPERLINK = originalForce;
    }
  });

  it('embeds UTM attribution in the link target while keeping the visible text clean', () => {
    process.env.FORCE_HYPERLINK = '1';
    const link = nxCloudHyperlink('nx-init');

    // Visible text is the bare URL (no querystring leaks into the label).
    expect(link).toContain(`${BEL}${NX_CLOUD_URL}${OSC}`);
    // Tracked URL is the link target only.
    expect(link).toContain(
      `${NX_CLOUD_URL}?utm_source=nx-cli&utm_medium=nx-init`
    );
  });

  it('falls back to the bare URL when hyperlinks are unsupported', () => {
    process.env.FORCE_HYPERLINK = '0';
    expect(nxCloudHyperlink('nx-migrate')).toBe(NX_CLOUD_URL);
  });
});
