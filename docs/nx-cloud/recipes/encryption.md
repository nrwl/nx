# Enable End to End Encryption

To turn on end to end encryption, specify an encryption key in one of two ways:

- Set the `encryptionKey` property in `nx.json`
- Set the `NX_CLOUD_ENCRYPTION_KEY` environment variable

The key can be any string up to 32 characters long.

Providing an encryption key tells Nx to encrypt task artifacts on your machine before they are sent to the remote cache. Then when cached results are downloaded to your machine they are decrypted before they are used. This ensures that even if someone gained access to the Nx Cloud servers, they wouldn't be able to view your task artifacts.

## Metadata

End to end encryption only applies to output files of a task. Terminal output and other metadata like the dependency graph and the time it takes a task to execute are still encrypted, but in such a way that Nx Cloud has access to them. This allows Nx Cloud to use that information to efficiently orchestrate tasks and to display your logs on nx.app.

## Summary

Data is encrypted both at rest and in transit.

- Every communication with the Nx Cloud API is encrypted in transit, including fetching/storing artifacts.
- When using Nx Public Cloud, the stored metadata is encrypted.
- When using Nx Public Cloud and e2e encryption, stored artifacts are encrypted.
- When using the on-prem version of Nx Cloud, the stored metadata is encrypted if you run MongoDB yourself with encryption on (or if you, for instance, use CosmosDB)
- When using the on-prem version of Nx Cloud, stored artifacts are encrypted using e2e encryption.
