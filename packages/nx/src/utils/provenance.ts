import { execFile } from 'child_process';
import { promisify } from 'util';

export async function ensurePackageHasProvenance(
  packageName: string,
  packageVersion: string
): Promise<void> {
  // this is used for locally released versions without provenance
  // do not set this for other reasons or you might be exposed to security risks
  if (process.env.NX_MIGRATE_SKIP_PROVENANCE_CHECK) {
    return;
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

  if (!attURL)
    throw noProvenanceError(
      packageName,
      packageVersion,
      'No attestation URL found'
    );

  const attestations = (await (await fetch(attURL)).json()) as {
    attestations: Attestation[];
  };

  const provenanceAttestation = attestations?.attestations?.find(
    (a) => a.predicateType === 'https://slsa.dev/provenance/v1'
  );
  if (!provenanceAttestation)
    throw noProvenanceError(
      packageName,
      packageVersion,
      'No provenance attestation found'
    );

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
    throw noProvenanceError(
      packageName,
      packageVersion,
      'Repository does not match nrwl/nx'
    );
  }
  if (workflowParameters?.path !== '.github/workflows/publish.yml') {
    throw noProvenanceError(
      packageName,
      packageVersion,
      'Publishing workflow does not match .github/workflows/publish.yml'
    );
  }
  if (workflowParameters?.ref !== `refs/tags/${npmViewResult.version}`) {
    throw noProvenanceError(
      packageName,
      packageVersion,
      `Version ref does not match refs/tags/${npmViewResult.version}`
    );
  }

  // verify that provenance was generated from the exact same artifact as the one we are installing
  const distSha = Buffer.from(
    npmViewResult.dist.integrity.replace('sha512-', ''),
    'base64'
  ).toString('hex');
  const attestationSha = dsseEnvelopePayload?.subject[0]?.digest.sha512;
  if (distSha !== attestationSha) {
    throw noProvenanceError(
      packageName,
      packageVersion,
      'Integrity hash does not match attestation hash'
    );
  }
  return;
}

export const noProvenanceError = (
  packageName: string,
  packageVersion: string,
  error?: string
) =>
  `An error occurred while checking the provenance of ${packageName}@${packageVersion}. This could indicate a security risk. Please double check https://www.npmjs.com/package/${packageName} to see if the package is published correctly or file an issue at https://github.com/nrwl/nx/issues \n Error: ${
    error ?? ''
  }`;

type Attestation = {
  predicateType: string;
  bundle: {
    dsseEnvelope: {
      payload: string; // base64 encoded JSON
      payloadType: string;
      signatures: {
        keyid: string;
        sig: string;
      }[];
    };
    mediaType: string;
    [x: string]: unknown;
  };
  [x: string]: unknown;
};

// referh to https://slsa.dev/spec/v1.1/provenance#schema
export type DecodedAttestationPayload = {
  _type: 'https://in-toto.io/Statement/v1';
  subject: unknown[];
  predicateType: 'https://slsa.dev/provenance/v1';
  predicate: {
    buildDefinition: {
      buildType: string;
      externalParameters: Record<string, any>;
      internalParameters?: Record<string, any>;
      resolvedDependencies?: ResourceDescriptor[];
    };
    runDetails: {
      builder: {
        id: string;
        builderDependencies?: ResourceDescriptor[];
        version?: Record<string, string>;
      };
      metadata?: {
        invocationId?: string;
        startedOn?: string; // <YYYY>-<MM>-<DD>T<hh>:<mm>:<ss>Z
        finishedOn?: string; // <YYYY>-<MM>-<DD>T<hh>:<mm>:<ss>Z
      };
      byproducts?: ResourceDescriptor[];
    };
  };
};

export interface ResourceDescriptor {
  uri?: string;
  digest?: {
    sha256?: string;
    sha512?: string;
    gitCommit?: string;
    [key: string]: string | undefined;
  };
  name?: string;
  downloadLocation?: string;
  mediaType?: string;
  content?: string;
  annotations?: {
    [key: string]: any;
  };
}
