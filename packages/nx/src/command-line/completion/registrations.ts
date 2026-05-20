// Side-effect imports populating the completion registry. Each
// command's completion.ts pulls only metadata helpers + providers, not
// the heavy command-object surface.

import '../run/completion';
import '../run-many/completion';
import '../affected/completion';
import '../show/completion';
import '../generate/completion';
import '../graph/completion';
import '../watch/completion';
import '../add/completion';
