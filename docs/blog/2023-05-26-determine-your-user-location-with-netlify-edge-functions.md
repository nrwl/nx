---
title: 'Determine your User Location with Netlify Edge Functions'
slug: 'determine-your-user-location-with-netlify-edge-functions'
authors: ['Nicholas Cunningham']
cover_image: '/blog/images/2023-05-26/1*G2ynKDm6DIKLcZ2fJlV0dw.png'
tags: [nx, tutorial]
---

Today, we will explore how to use `@nx/netlify` serverless functions to determine a user’s location. This can be an incredibly useful feature in various applications, such as customizing user experiences based on their region, displaying localized content, or tracking user demographics for marketing purposes. In this post, we’ll walk you through a step-by-step guide on implementing this functionality using `@nx/netlify` serverless functions.

Before we get started though, here’s a video introduction to the new `@nx/netlify` package:

{% youtube src="https://youtu.be/idH6GCkWq0w" /%}

### Step 1: Set up your Nx workspace with Netlify

To get started, you need to have an Nx workspace. If you haven’t already, create a new Nx workspace by running:

```shell
npx create-nx-workspace user-location --preset=@nx/netlify
```

This should create a default function inside `src/functions/hello/hello.ts`, which can be _safely deleted_ if necessary.

### Step 2: Create a serverless function

```
mkdir src/functions/user-location
touch src/functions/user-location/user-location.ts
```

### Step 3: Determine the user’s location

To determine the user’s location, we will leverage the `request.headers` object, specifically the `x-forwarded-for` header containing the user’s IP address. We can then use an IP geolocation API like ipapi ([https://ipapi.co/](https://ipapi.co/)) to fetch location data based on this IP address.

_Note_ in **Node.js 18**, the experimental global fetch API is available by default. If you are using a node version **lower** than **18** you can install `node-fetch` to handle API requests:

```
npm install node-fetch
```

Now, update the `user-location.ts` file with the following code:

```
import { Handler } from "@netlify/functions";
import fetch from "node-fetch"; // Can be removed if node >= 18

export const handler: Handler = async (event, _) => {
  const ip = event.headers["x-forwarded-for"];
  const url = `https://ipapi.co/${ip}/json/`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({
        location: {
          city: data.city,
          region: data.region,
          country: data.country,
        },
      }),
    };
  } catch (error) {
    return { statusCode: 500, body: `Error fetching user location` };
  }
};
```

### Step 4: Deploy your serverless function

When we created our workspace, the initial scaffolding generated a **deploy-target** inside our `project.json`.

> A **target** is a specific task you can run for a project.  
> You can think of it as a script/command that does a specific job. The most common targets are “build”, “serve”, “test”, “lint”, “deploy”, etc. For more information regarding `project.json` you can read about it at [project-configuration](/reference/project-configuration)

We can start off by creating our site on Netlify by running:

```shell
npx netlify init
```

After you have answered all the prompts your site should be created. A `.netlify` folder should be created with references to your newly created site.

Now, to deploy your serverless function run:

```
nx run deploy
```

Finally, navigate to your Netlify site’s Functions tab, and you should see your `user-location` function deployed and ready to use!

For example, ours can be found at: [https://644a9b17d0299b00b581b33f--find-user-location.netlify.app/.netlify/functions/user-location](https://644a9b17d0299b00b581b33f--find-user-location.netlify.app/.netlify/functions/user-location)

```json
{ "location": { "city": "Miami", "region": "Florida", "country": "US" } }
```

By following these steps, you’ve successfully used `@nx/netlify` serverless function to determine a user’s location!

### Wrapping up

Never used Nx before? Learn more about Nx [here](/getting-started/why-nx).  
[Official recipe from Nx](/recipes/node/node-serverless-functions-netlify)  
[Github example](https://github.com/ndcunningham/nx-netlify-serverless)

### Learn more

🧠 [Nx Docs](/getting-started/intro)  
👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)  
💬 [Nx Official Discord Server](https://go.nx.dev/community)
📹 [Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)  
🚀 [Speed up your CI](/nx-cloud)
