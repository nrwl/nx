# Enable End to End Encryption

To turn on end to end encryption, specify an encryption key in one of two ways:

- Set the `nxCloudEncryptionKey` property in `nx.json`
- Set the `NX_CLOUD_ENCRYPTION_KEY` environment variable

The key can be any string up to 32 characters long.

Providing an encryption key tells Nx to encrypt task artifacts on your machine before they are sent to the remote cache. Then when cached results are downloaded to your machine they are decrypted before they are used. This ensures that even if someone gained access to the Nx Cloud servers, they wouldn't be able to view your task artifacts.

## Metadata

All the artifacts Nx Cloud uses to replay a task for you are encrypted. That means that even if someone gets access to your Nx Cloud storage bucket, they will not be able to tamper with the files and terminal output that is restored when the task is replayed on your CI or developer's machines.

We also store an un-encrypted version of the terminal output separately that is accessible only to invited members of the workspace on the Nx Cloud web app, so they can see why certain tasks failed. This un-encrypted output is only used in the browser, and not used when replaying the task.

## Summary

Data is encrypted both at rest and in transit.

- Every communication with the Nx Cloud API is encrypted in transit, including fetching/storing artifacts.
- When using Nx Public Cloud, the stored metadata is encrypted.
- When using Nx Public Cloud and e2e encryption, stored artifacts are encrypted.
- When using the on-prem version of Nx Cloud, the stored metadata is encrypted if you run MongoDB yourself with encryption on (or if you, for instance, use CosmosDB)
- When using the on-prem version of Nx Cloud, stored artifacts are encrypted using e2e encryption.
