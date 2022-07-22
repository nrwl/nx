# Applications and libraries

A typical Nx workspace is structured into _"apps"_ and _"libs"_. This distinction allows us to have a more modular architecture by following a separation of concerns methodology, incentivising the organisation of our source code and logic into smaller, more focused and highly cohesive units.

Nx automatically creates TypeScript path mappings in the `tsconfig.base.json` file, such that they can be easily consumed by other apps or libs.

```typescript
// example of importing from another workspace library
import { Button } from '@my-organization/ui';
...
```

Therefore, consuming libraries is very straightforward, and similar to what you might already be accustomed to in previous projects.

Having a dedicated library project is a much stronger boundary compared to just separating code into folders, though. Each Nx library has a so-called _"public API"_, represented by an `index.ts` barrel file. This forces developers into an _"API thinking"_ of what should be exposed and thus be made available for others to consume, and what on the others side should remain private within the library itself.

{% callout type="caution" title="Library !== published artefact" %}
[This is a common misconception, moving code into libraries can be done from a pure code organization perspective](#misconception).
{% /callout %}

## Mental model

A common mental model is to **see the application as "containers"** that link, bundle and compile functionality implemented in libraries for being deployed.
As such, if we follow a _80/20 approach_:

- place 80% of your logic into the `libs/` folder
- and 20% into `apps/`

Note, these libraries don’t necessarily need to be built separately, but are rather consumed and built by the application itself directly. Hence, nothing changes from a pure deployment point of view.

That said, it is totally possible to create so-called _"[buildable libraries](/structure/buildable-and-publishable-libraries#buildable-libraries)"_ for enabling incremental builds as
well as _"[publishable libraries](/structure/buildable-and-publishable-libraries#publishable-libraries)"_ for those scenarios where not only you want to
use a specific library within the current Nx workspace, but also to publish it
to some package repository (e.g NPM).

### Misconception

> Developers new to Nx are initially often hesitant to move their logic into libraries, because they assume it implies that those libraries need to be general purpose and shareable across applications.

**This is a common misconception, moving code into libraries can be done from a pure code organization perspective.**

Ease of re-use might emerge as a positive side effect of refactoring code into libraries by applying an _"API thinking"_ approach. It is not the main driver though.

In fact when organizing libraries you should think about your business domains.

Most often teams are aligned with those domains and thus a similar organization of the libraries in the `libs/` folder might be most appropriate. Nx allows to nest libraries into sub-folders which makes it easy to reflect such structuring.

- [Learn more about when you need to create a new library or using an existing one](/structure/creating-libraries)
- [Learn more about the different types of libraries we think you should follow](/structure/library-types)
- [Learn more about how to group libraries between each others](/structure/grouping-libraries)
