import { execFile } from 'child_process';
import { promisify } from 'util';

export async function checkPackageHasProvenance(
  packageName: string,
  packageVersion: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // this is used for locally released versions without provenance
  // do not set this for other reasons or you might be exposed to security risks
  if (process.env.NX_MIGRATE_SKIP_PROVENANCE_CHECK) {
    return {
      success: true,
    };
  }
  const execFileAsync = promisify(execFile);

  const npmViewResult = JSON.parse(
    (
      await execFileAsync(
        'npm',
        ['view', `${packageName}@${packageVersion}`, '--json'],
        {
          timeout: 20000,
        }
      )
    ).stdout.trim()
  );

  const attURL = npmViewResult.dist?.attestations?.url;

  if (!attURL) return { success: false, error: 'No attestation URL found' };

  // refer to https://slsa.dev/spec/v1.1/provenance#schema for the shape of this object
  const attestations = (await (await fetch(attURL)).json()) as any;

  const provenanceAttestation = attestations?.attestations?.find(
    (a) => a.predicateType === 'https://slsa.dev/provenance/v1'
  );
  if (!provenanceAttestation)
    return { success: false, error: 'No provenance attestation found' };

  const dsseEnvelopePayload = JSON.parse(
    Buffer.from(
      provenanceAttestation.bundle.dsseEnvelope.payload,
      'base64'
    ).toString()
  );

  const workflowParameters =
    dsseEnvelopePayload?.predicate?.buildDefinition?.externalParameters
      ?.workflow;

  // verify that provenance was actually generated from the right publishing workflow
  if (workflowParameters?.repository !== 'https://github.com/nrwl/nx') {
    return { success: false, error: 'Repository does not match nrwl/nx' };
  }
  if (workflowParameters?.path !== '.github/workflows/publish.yml') {
    return {
      success: false,
      error: 'Publishing workflow does not match .github/workflows/publish.yml',
    };
  }
  if (workflowParameters?.ref !== `refs/tags/${npmViewResult.version}`) {
    return {
      success: false,
      error: `Version ref does not match refs/tags/${npmViewResult.version}`,
    };
  }

  // verify that provenance was generated from the exact same artifact as the one we are installing
  const distSha = Buffer.from(
    npmViewResult.dist.integrity.replace('sha512-', ''),
    'base64'
  ).toString('hex');
  const attestationSha = dsseEnvelopePayload?.subject[0]?.digest.sha512;
  if (distSha !== attestationSha) {
    return {
      success: false,
      error: 'Integrity hash does not match attestation hash',
    };
  }
  return { success: true };
}

export const noProvenanceError = (
  packageName: string,
  packageVersion: string,
  error?: string
) =>
  `An error occurred while checking the provenance of ${packageName}@${packageVersion}. This could indicate a security risk. Please file an issue at https://github.com/nrwl/nx/issues \n ${
    error ?? ''
  }`;
