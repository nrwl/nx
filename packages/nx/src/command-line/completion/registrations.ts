/**
 * Barrel of side-effect imports that populate the completion registry.
 * Loading this is intentionally cheap — each `<command>/completion.ts`
 * file imports only the metadata helpers and the providers it needs,
 * not the heavy `<command>/command-object.ts` (yargs builders, shared
 * options, handlers, etc.).
 *
 * Routing imports this barrel directly so the metadata-driven fast
 * path can run without loading the full nx-commands surface.
 */

import '../run/completion';
import '../run-many/completion';
import '../affected/completion';
import '../show/completion';
import '../generate/completion';
import '../graph/completion';
import '../watch/completion';
import '../add/completion';
