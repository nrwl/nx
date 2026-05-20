import { registerCompletion } from '../completion/metadata';

// Derived from nx's own packageGroup — same list `nx report` uses.
// Auto-updates as new first-party plugins land in nx-migrations.
const FIRST_PARTY_PLUGINS: string[] = (
  require('nx/package.json')['nx-migrations'].packageGroup as Array<
    string | { package: string }
  >
)
  .map((e) => (typeof e === 'string' ? e : e.package))
  .filter((p) => p.startsWith('@nx/'))
  .sort();

registerCompletion('add', {
  positionals: [
    {
      complete: (current) =>
        FIRST_PARTY_PLUGINS.filter((p) => p.startsWith(current)),
    },
  ],
});
