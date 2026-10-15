import { fingerprintAgentFile } from './legacy-agent-config';
import { legacyAgentFiles } from './legacy-agent-files';

describe('fingerprintAgentFile', () => {
  it('should ignore formatting changes made by a formatter', () => {
    const shipped =
      '# Monitor CI\n\n* Poll the pipeline\n* Apply *self-healing* fixes\n\n| a | b |\n|---|---|\n';
    const formatted =
      '# Monitor CI\n\n- Poll the pipeline\n- Apply _self-healing_ fixes\n\n| a   | b   |\n| --- | --- |\n';

    expect(fingerprintAgentFile(formatted)).toEqual(
      fingerprintAgentFile(shipped)
    );
  });

  it('should change when the wording changes', () => {
    expect(fingerprintAgentFile('Poll the pipeline')).not.toEqual(
      fingerprintAgentFile('Poll the pipeline twice')
    );
  });
});

describe('legacyAgentFiles', () => {
  it('should only list files that were copied into workspaces', () => {
    for (const path of Object.keys(legacyAgentFiles)) {
      expect(path).toMatch(
        /^\.(agents|codex\/agents|cursor|opencode|github|gemini)\//
      );
    }
  });

  it('should hold well-formed fingerprints', () => {
    for (const fingerprints of Object.values(legacyAgentFiles)) {
      expect(fingerprints.length).toBeGreaterThan(0);
      for (const fingerprint of fingerprints) {
        expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
      }
    }
  });
});
