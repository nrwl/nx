---
title: 'Google Drops Bazel in favor of Nx (edit: April Fools 😉)'
slug: 'google-drops-bazel-in-favor-of-nx'
authors: ['Nx']
cover_image: '/blog/images/2022-04-01/1*6xqPcYeQnOHvVOXzD9HUww.png'
tags: [nx, release]
---

_In an attempt to lower maintenance costs and increase developer productivity, going forward Google has made the decision to fully embrace the open-source monorepo tool Nx._

Nx has been around for more than 5 years having gained not only a high level of maturity but at the same time massive adoption in the community, now amounting to [more than **1.6 million weekly downloads**](https://www.npmjs.com/package/@nrwl/tao), experiencing a 50% growth just in the last 3 months.

![](/blog/images/2022-04-01/1*bl-VAHTmPm-2u7sQz6Mj5w.avif)

[Nx’s plugin system and developer kit](https://nx.dev/using-nx/nx-devkit) have proven to be lightweight and still flexible enough to adapt to a variety of different ecosystems. Such extensibility is massively important for Google’s environment, allowing Nx to work beyond just pure JavaScript-based frontend development and potentially also leveraging the [vast set of community plugins](https://nx.dev/community) that are already available.

> _🤡🤡🤡🤡🤡🤡🤡🤡🤡🤡_  
> It’s **April Fool’s day**, so guess we got you _😅_. Sorry for that, but definitely keep reading. While Google is probably not dropping Blaze/Bazel (although Google, if you wanna reach out, we’re all ears), the rest of the article is actually 100% the truth, promise _🙂_.  
> _🤡🤡🤡🤡🤡🤡🤡🤡🤡🤡_

Now, while extensibility is important, Google was searching for something that could match its massive scale, allowing it to cope with the thousands of developers that daily commit to its monorepo and which should not suffer any productivity drain. Nx’s [distributed computation cache](https://nx.dev/using-nx/caching) helps with that and while Google’s scale will probably outgrow Nx Cloud’s free 500 hours per month offer, they can still benefit from [hosting Nx Private Cloud](https://nx.app/private-cloud) in their massive data centers.

![[object HTMLElement]](/blog/images/2022-04-01/0*odpETKdlY3ZejNd2.avif)
_Nx’s distributed caching powered by Nx Cloud_

Lowering their current maintenance and configuration costs being one of the main drivers, engineers found Nx Cloud’s [distributed task execution (DTE) model](https://nx.app/docs/distributed-execution) extremely appealing. With minimal to no configuration, Nx Cloud DTE is able to leverage historical run data to automatically spin up agents on CI and thus achieve a high degree of parallelism, maximizing utilization and avoiding idle times.

![[object HTMLElement]](/blog/images/2022-04-01/0*86wfD69z0YFiIFXN.avif)
_Nx Cloud DTE agents parallelizing work_

If you’re in a similar position, aiming to

- lower maintenance costs of your developer build infrastructure
- benefit from a high degree of developer ergonomics
- leverage a vibrant community and rich plugin ecosystem
- benefit from speed improvements coming from local computation caching and Nx Clouds cache distribution and DTE (note, for you [500 free hours/month](https://medium.com/more-time-saved-for-free-with-nx-cloud-d7079b95f7ca) might actually be more than enough 😉)

then definitely reach out. Go to

- Nx website: [https://nx.dev](https://nx.dev)
- Connect on Twitter: [https://twitter.com/nxdevtools](https://twitter.com/nxdevtools)
- Youtube: [https://www.youtube.com/nrwl_io](https://www.youtube.com/nrwl_io)
- Join the Nx Community: [https://go.nrwl.io/join-slack](https://go.nrwl.io/join-slack)

**And note, today is a special day (April 1st), so don’t take everything too seriously 😉**
