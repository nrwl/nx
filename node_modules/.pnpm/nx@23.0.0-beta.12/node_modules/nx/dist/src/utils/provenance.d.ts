export declare function ensurePackageHasProvenance(packageName: string, packageVersion: string): Promise<void>;
export declare class ProvenanceError extends Error {
    constructor(packageName: string, packageVersion: string, error?: string);
}
export declare function getNxPackageGroup(): string[];
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
                startedOn?: string;
                finishedOn?: string;
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
