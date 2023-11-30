# End to End Encryption

Data is encrypted both at rest and in transit.

- Every communication with the Nx Cloud API is encrypted in transit, including fetching/storing artifacts.
- When using Nx Public Cloud, the stored metadata is encrypted.
- When using Nx Public Cloud and e2e encryption, stored artifacts are encrypted.
- When using the on-prem version of Nx Cloud, the stored metadata is encrypted if you run MongoDB yourself with encryption on (or if you, for instance, use CosmosDB)
- When using the on-prem version of Nx Cloud, stored artifacts are encrypted using e2e encryption.

You can set the `encryptionKey` property in `nx.json` or set the `NX_CLOUD_ENCRYPTION_KEY` environment variable to
enable the e2e encryption of your artifacts. In this case, the artifacts will be encrypted/decrypted on your machine.
