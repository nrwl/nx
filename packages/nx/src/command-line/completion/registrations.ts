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
// Must be last — infix-targets skips any name already registered above
// so a real Nx command (`run`, `add`, ...) wins over a same-named target.
import './infix-targets';
