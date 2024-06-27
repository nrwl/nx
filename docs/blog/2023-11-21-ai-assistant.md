---
title: Nx Docs AI Assistant
slug: 'nx-docs-ai-assistant'
authors: [Katerina Skroumpelou]
cover_image: '/blog/images/2023-11-21/featured_img.webp'
tags: [nx, docs, AI]
---

## Introduction

The [Nx Docs AI Assistant](/ai-chat) is a tool designed to provide users with answers straight from the Nx documentation. In this article I will explain how it is built, and how we ensure accuracy and relevance.

In the end of this document I have added a [“glossary”](#glossary) of terms that are used throughout this document.

## Why have an AI assistant for documentation?

First of all, let’s answer this simple question: why do you need an AI assistant for a documentation site in the first place? Using an AI assistant for documentation search and retrieval can offer a number of benefits for both users and authors. For users, the challenges of navigating through a large volume and density of documentation are alleviated. Unlike static keyword matching, AI enables more personalized and contextual search, allowing for more complex or sophisticated queries beyond simple keywords. This creates a dynamic feedback loop where users can ask follow-up questions, mix and combine documents, and ultimately enjoy an enhanced user experience that goes beyond basic documentation retrieval.

For authors, a docs AI assistant provides valuable insights into user behavior. It can identify the questions users are frequently asking, pointing to areas where more documentation may be needed. Additionally, if the AI consistently provides unsatisfactory or incorrect responses to certain queries, it could highlight unclear or lacking portions of the documentation. This not only allows for targeted improvements but also makes more parts of the documentation easily accessible to users through intelligent linking. Overall, it can enrich user interaction and help with future content strategy.

## The Nx Docs AI Assistant Workflow

### Overview

In a nutshell, the Nx Docs AI Assistant works in the following way:

1. Split our docs into smaller chunks
2. Create an [embedding](#embeddings) for each chunk
3. Save all these embeddings in [Postgres using pgvector (Supabase!)](https://supabase.com/docs/guides/database/extensions/pgvector)
4. Get question from the user
5. Create embedding for user’s question
6. Perform a vector similarity search on your database — bring back all the chunks of your documentation that are similar to the user’s question
7. Use the [GPT chat completion](https://platform.openai.com/docs/guides/text-generation/chat-completions-api) function. Pass a prompt, the user’s question and the retrieved chunks from the docs. GPT will then try to extract the relevant facts from these chunks, in order to formulate a coherent answer.

This is based on the Web Q&A Tutorial from OpenAI [(https://platform.openai.com/docs/tutorials/web-qa-embeddings)](https://platform.openai.com/docs/tutorials/web-qa-embeddings) and Supabase’s Vector Search example [(https://supabase.com/docs/guides/ai/examples/nextjs-vector-search)](https://supabase.com/docs/guides/ai/examples/nextjs-vector-search).

It’s important to note here that we are not “training the model on our docs”. The model is pretrained. We are just giving the model parts of our docs which are relevant to the user’s question, and the model creates a coherent answer to the question. It’s basically like pasting in ChatGPT a docs page and asking it “how do I do that?”. Except in this case, we’re first searching our documentation and giving GPT only the relevant parts (more about how we do that later in this article), which it can “read” and extract information from.

## Step 1: Preprocessing our docs

Every few days, we run an [automated script that will generate embeddings](https://github.com/nrwl/nx/blob/76306f0bedc1297b64da6e58b4f7b9c39711cd82/.github/workflows/generate-embeddings.yml) (numeric/vector representations of words and phrases) for our documentation, and store these embeddings in Supabase. As mentioned above, this step has 3 parts:

### Split our docs into smaller chunks

Most of this code follows the example from [Supabase’s Clippy](https://github.com/supabase-community/nextjs-openai-doc-search). It breaks the markdown tree into chunks, it keeps the heading and it also creates a checksum, to keep track of changes.

Ref in the code: [https://github.com/nrwl/nx/blob/0197444df5ea906f38f06913b2bc366e04b0acc2/tools/documentation/create-embeddings/src/main.mts#L66](https://github.com/nrwl/nx/blob/0197444df5ea906f38f06913b2bc366e04b0acc2/tools/documentation/create-embeddings/src/main.mts#L66)

This part is copied from: [https://github.com/supabase-community/nextjs-openai-doc-search/blob/main/lib/generate-embeddings.ts](https://github.com/supabase-community/nextjs-openai-doc-search/blob/main/lib/generate-embeddings.ts)

```js
export function processMdxForSearch(content: string) {
  // …
  const mdTree = fromMarkdown(content, {});
  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading');
  // …
  const sections = sectionTrees.map((tree: any) => {
    const [firstNode] = tree.children;
    const heading =
      firstNode.type === 'heading' ? toString(firstNode) : undefined;
    return {
      content: toMarkdown(tree),
      heading,
      slug,
    };
  });
  return {
    checksum,
    sections,
  };
}
```

### Create an embedding for each chunk

Using `openai.embeddings.create` function with the model “text-embedding-ada-002” we are creating an embedding for each chunk.

Ref in the code: [https://github.com/nrwl/nx/blob/76306f0bedc1297b64da6e58b4f7b9c39711cd82/tools/documentation/create-embeddings/src/main.mts#L314](https://github.com/nrwl/nx/blob/76306f0bedc1297b64da6e58b4f7b9c39711cd82/tools/documentation/create-embeddings/src/main.mts#L314)

```js
const embeddingResponse = await openai.embeddings.create({
  model: 'text-embedding-ada-002',
  input,
});
```

### Save all these embeddings in Postgres using pgvector, on Supabase.

Store this embedding in Supabase, in a database that has already been created, following the steps mentioned here:

[https://supabase.com/docs/guides/ai/examples/nextjs-vector-search?database-method=dashboard#prepare-the-database](https://supabase.com/docs/guides/ai/examples/nextjs-vector-search?database-method=dashboard#prepare-the-database)

Essentially, we are setting up two PostgreSQL tables on Supabase. Then, we are inserting the embeddings into these tables.

Ref in code: [https://github.com/nrwl/nx/blob/master/tools/documentation/create-embeddings/src/main.mts#L327](https://github.com/nrwl/nx/blob/master/tools/documentation/create-embeddings/src/main.mts#L327)

```js
const { data: pageSection } = await supabaseClient
  .from('nods_page_section')
  .insert({
    page_id: page.id,
    slug,
    heading,
    longer_heading,
    content,
    url_partial,
    token_count,
    embedding,
  }); // …
```

## Step 2: User query analysis and search

When a user poses a question to the assistant, we calculate the embedding for the user’s question. The way we do that is, again, using openai.embeddings.create function with the model text-embedding-ada-002.

Ref in code: [https://github.com/nrwl/nx/blob/76306f0bedc1297b64da6e58b4f7b9c39711cd82/nx-dev/nx-dev/pages/api/query-ai-handler.ts#L58](https://github.com/nrwl/nx/blob/76306f0bedc1297b64da6e58b4f7b9c39711cd82/nx-dev/nx-dev/pages/api/query-ai-handler.ts#L58)

```js
const embeddingResponse: OpenAI.Embeddings.CreateEmbeddingResponse =
  await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: sanitizedQuery + getLastAssistantMessageContent(messages),
  });
```

The assistant compares the query embedding with these documentation embeddings to identify relevant sections. This comparison is essentially measuring how close the query’s vector is to the documentation vectors. The closer they are, the more related the content. The way this works is that it sends the user’s question embedding to Supabase, to a PostgreSQL function, which runs a vector comparison between the user’s question embedding and the stored embeddings in the table. The PostgreSQL function returns all the similar documentation chunks.

The function that is used uses the dot product between vectors to calculate similarity. For normalized vectors, the dot product is equivalent to cosine similarity. Specifically, when two vectors A and B are normalized (i.e., their magnitudes are each 1), the cosine similarity between them is the same as their dot product. The OpenAI embeddings are normalized to length 1, so cosine similarity and dot product will produce the same results.

Ref in code: [https://github.com/nrwl/nx/blob/76306f0bedc1297b64da6e58b4f7b9c39711cd82/nx-dev/nx-dev/pages/api/query-ai-handler.ts#L70](https://github.com/nrwl/nx/blob/76306f0bedc1297b64da6e58b4f7b9c39711cd82/nx-dev/nx-dev/pages/api/query-ai-handler.ts#L70)

```js
const { data: pageSections } = await supabaseClient.rpc('match_page_sections', {
  embedding,
  // …
});
```

## Step 3: Generating a Response

With the relevant sections (documentation chunks) identified and retrieved, GPT (the generative AI) steps in. Using the relevant sections as context and following a systematic approach, GPT crafts a response.

This approach the AI is instructed to use (in the **prompt**) is the following:

- Identify CLUES from the query and documentation.
- Deduce REASONING based solely on the provided Nx Documentation.
- EVALUATE its reasoning, ensuring alignment with Nx Documentation.
- Rely on previous messages for contextual continuity.

### Ensuring Quality

If there’s no matching section in the documentation for a query, the script throws a “no_results” error. So, after the initial search in the docs (PostgreSQL function), if the search returns no results (no vectors found that are similar enough to the user’s question vector), the process stops, and our Assistant replies that it does not know the answer.

### The use of useChat function

It’s necessary here to clarify that we use the useChat [(https://sdk.vercel.ai/docs/api-reference/use-chat)](https://sdk.vercel.ai/docs/api-reference/use-chat) function of the [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction). This function, as mentioned in the docs, does the following:

> It enables the streaming of chat messages from your AI provider, manages the state for chat input, and updates the UI automatically as new messages are received.

It essentially takes care of the following things:

1. You don’t have to worry about manually creating a “messages” array to store your “conversation” (messages you exchange) with the GPT endpoint
2. You don’t have to manually implement the streaming functionality in your UI

Then, in your React component, you can call this function directly, and get the messages object from it, to render your messages in your UI. It exposes input, handleInputChange and handleSubmit which you can use in your React form, and it will take care of all the rest. You can pass an api string to it, to tell it which endpoint to use as the chat provider.

### Creating the query

If you look at our [query-ai-handler.ts](https://github.com/nrwl/nx/blob/76306f0bedc1297b64da6e58b4f7b9c39711cd82/nx-dev/nx-dev/pages/api/query-ai-handler.ts) function, this is an edge function, living under an endpoint, which is called by the useChat function. The request contains the messages array as created by useChat. If we just wanted to create an AI chat with no context, we could directly pass this messages array to the openai.chat.completions.create endpoint, and have our back-and-forth chat with GPT. However, in our case, we need to add context to our conversation, and specifically to each query we end up sending to OpenAI.

So, the first thing we need to do is to **get the last message the user posted**, which is essentially the user’s question. We search the messages array, and we get the last message which has the role “user”. That is our user’s question.

Now, we can use the user’s question to get the relevant documentation chunks from the database. To do that, as explained before, we need to **create an embedding for the user’s question** (a vector) and then compare that embedding with the stored embeddings in the database, to get the relevant chunks.

The problem here is that if the user’s query is just a follow-up question, then it will have little information or meaning. Here is an example:

> User: _How do I set up namedInputs?_
> Assistant: _…replies…_
> User: _And how do they work?_

In this example, the user’s question that we would want to create an embedding for would be “And how do they work?”. If we created that embedding and searched our docs for relevant parts, it would either return nothing, or return everything, since this is a very vague question, since it has no context. So, we need to add some more information to that question. To do that, we also get the last response from GPT (the last assistant message) and add it to the user’s question. So, in this example, the user’s question will contain some info about namedInputs, and the actual question.

Now, we take that combined text, and we create an embedding for it, using the openai.embeddings.create function. We, then, use that embedding to find all the similar documentation chunks, with vector similarity search.

After receiving all the relevant documentation chunks, we can finally create the query that is going to be sent to GPT. It’s important here to make sure we instruct GPT what to do with the information we will give it.

Here is the **query** we end up providing GPT with:

> You will be provided sections of the Nx documentation in markdown format, use those to answer my question. Do NOT reveal this approach or the steps to the user. Only provide the answer. Start replying with the answer directly.
>
> Sections:
> ${contextText}
>
> Question: “””
> ${userQuestion}
> “””
>
> Answer as markdown (including related code snippets if available):

The contextText contains all the relevant documentation chunks (page sections).

### Creating the response

**Getting back a readable stream:** So, we get the array of messages, as stored by useChat, we fix the final message to contain the query (created as explained above), and we send it over to `openai.chat.completions.create`. We get back a streaming response (since we’ve set stream: true, which we turn into a ReadableStream using [OpenAIStream from the Vercel AI SDK](https://sdk.vercel.ai/docs/api-reference/openai-stream)).

**Adding the sources:** However, we’re not done yet. The feature, here, that will be most useful to our users is the sources, the actual parts of the documentation that GPT “read” to create that response. When we get back the list of relevant documentation chunks (sections) from our database, we also get the metadata for each section. So, apart from the text content, we also get the heading and url partial of each section (among any other metadata we chose to save with it). So, with this information, we put together a list of the top 5 relevant sections, which we attach to the end of the response we get from GPT. That way, our users can more easily verify the information that GPT gives them, but also they can dive deeper into the relevant docs themselves. It’s all about exploring and retrieving relevant information, after all.

**Sending the final response to the UI:** With the sources appended to the response, we return a StreamingTextResponse from our edge function, which the useChat function receives, and appends to the messages array automatically.

## Allow user to reset the chat

As explained, each question and answer relies on the previous questions and answers of the current chat. If a user needs to ask something completely irrelevant or different, we are giving the user the ability to do so by providing a “Clear chat” button, which will reset the chat history, and start clean.

## Gathering feedback and evaluating the results

It’s very important to gather feedback from the users and evaluate the results. Any AI assistant is going to give wrong answers, because it does not have the ability to critically evaluate the responses it creates. It relies on things it has read, but not in the way a human relies on them. It generates the next most probable word (see glossary for generative AI below). For that reason, it’s important to do the following things:

1. Inform users that they should always double-check the answers and do not rely 100% on the AI responses
2. Provide users with feedback buttons and/or a feedback form, where they can evaluate whether a response was good or bad. At Nx we do that, and we also associate each button click with the question the user asked, which will give us an idea around which questions the AI gets right or wrong.
3. Have a list of questions that you ask the AI assistant, and evaluate its responses internally. Use these questions as a standard for any changes made in the assistant.

## Wrapping up

In this guide, we’ve explored the intricacies of the Nx Docs AI Assistant, an innovative tool that enhances the experience of both users and authors of Nx documentation. From understanding the need for an AI assistant in navigating complex documentation to the detailed workflow of the Nx Docs AI Assistant, we have covered the journey from preprocessing documentation to generating coherent and context-aware responses.

Let’s see at some key takeaways:

**Enhanced User Experience:** The AI assistant significantly improves user interaction with documentation by offering personalized, context-aware responses to queries. This not only makes information retrieval more efficient but also elevates the overall user experience.

**Insights for Authors:** By analyzing frequently asked questions and areas where the AI struggles, authors can pinpoint documentation gaps and areas for improvement, ensuring that the Nx documentation is as clear and comprehensive as possible.

**OpenAI API utilization:** The use of embeddings, vector similarity search, and GPT’s generative AI capabilities demonstrate a sophisticated approach to AI-driven documentation assistance. This blend of technologies ensures that users receive accurate and relevant responses.

**Continuous Learning and Improvement:** The system’s design includes mechanisms for gathering user feedback and evaluating AI responses, which are crucial for ongoing refinement and enhancement of the assistant’s capabilities.

**Transparency and User Trust:** By openly communicating the limitations of the AI and encouraging users to verify the information, the system fosters trust and promotes responsible use of AI technology.

**Accessibility and Efficiency:** The AI assistant makes Nx documentation more accessible and navigable, especially for complex or nuanced queries, thereby saving time and enhancing productivity and developer experience.

## Future steps

OpenAI released the Assistants API, which takes the burden of chunking the docs, creating embeddings, storing the docs in a vector database, and querying that database off the shoulders of the developers. This new API offers all these features out of the box, removing the need to create a customized solution, as the one explained above. It’s still in beta, and it remains to be seen how it’s going to evolve, and if it’s going to overcome some burdens it poses at the moment. You can [read more about the new Assistants API in this blog post](https://pakotinia.medium.com/openais-assistants-api-a-hands-on-demo-110a861cf2d0), which contains a detailed demo on how to use it for documentation q&a.

## Glossary

### Core concepts

I find it useful to start by explaining what some terms — which are going to be used quite a lot throughout this blog post — mean.

### Embeddings

#### What they are

In the context of machine learning, embeddings are a type of representation for text data. Instead of treating words as mere strings of characters, embeddings transform them into **vectors** (lists of numbers) in a way that captures their meanings. In embeddings, vectors are like digital fingerprints for words or phrases, converting their essence into a series of numbers that can be easily analyzed and compared.

#### Why they matter

With embeddings, words or phrases with similar meanings end up having **vectors** that are close to each other, making it easier to compare and identify related content.

### Generative AI

#### What it is

Generative AI, the technology driving the Nx Docs AI Assistant, is a subset of AI that’s trained, not just to classify input data, but to generate new content.

#### How it works

Generative AI operates like a sophisticated software compiler. Just as a compiler takes in high-level code and translates it into machine instructions, generative AI takes in textual prompts and processes them through layers of neural network operations, resulting in detailed and coherent text outputs. It’s like providing a programmer with a high-level task description, and they write the necessary code to achieve it, except here the ‘programmer’ is the AI, and the ‘code’ is the generated text response.

#### What Does “Generation” Mean in AI Context?

In AI, especially with natural language processing models, “generation” refers to the process of producing sequences of data, in our case, text. It’s about creating content that wasn’t explicitly in the training data but follows the same patterns and structures.

#### How Does GPT Predict the Next Word?

For our Nx Docs AI assistant we use GPT. GPT, which stands for “Generative Pre-trained Transformer”, works using a predictive mechanism. At its core, it’s trained to predict the next word in a sentence. When you provide GPT with a prompt, it uses that as a starting point and keeps predicting the next word until it completes the response or reaches a set limit.

It’s like reading a sentence and trying to guess the next word based on what you’ve read so far. GPT does this but by using a massive amount of textual data it has seen during training, enabling it to make highly informed predictions.

### Context and Prompting — their role in AI models

#### Context

In the context of AI, “context” refers to the surrounding information, data, or conditions that provide a framework or background for understanding and interpreting a specific input, ensuring that the AI’s responses or actions are relevant, coherent, and meaningful in a given situation

#### Prompts

The prompt acts as an initial “seed” that guides the AI’s output. While the AI is trained on vast amounts of text, it relies on the prompt for context. For example, a prompt like “tell me about cats” might result in a broad answer, but “summarize the history of domesticated cats” narrows the model’s focus.

By refining prompts, users can better direct the AI’s response, ensuring the output matches their intent. In essence, the prompt is a tool to direct the AI’s vast capabilities to a desired outcome.

### The GPT Chat Completion Roles

### System

The “System” role typically sets the “persona” or the “character” of the AI. It gives high-level instructions on how the model should behave during the conversation. We start the instructions with “You are a knowledgeable Nx representative.” We also instruct the model about the format of its answer: “Your answer should be in the form of a Markdown article”. You can read the full instructions on GitHub.

#### User

The “User” role is straightforward. This is the input from the end-user, which the AI responds to. The user’s query becomes the User role message. This role guides what the AI should be talking about in its response. It’s a direct prompt to the AI to generate a specific answer. In our case, we take the user’s query, and we add it in a longer prompt, which specific steps the model must follow (as explained above). That way, the model focuses on the specific steps we’ve laid out, making it the immediate context for generating the answer. This is one more step towards more accurate answers based on our documentation only. Inside the prompt, which has the instructions, and the user’s query, we always add the context text as well, which are the relevant parts that are retrieved from the Nx Documentation.

#### Assistant

This role, in the context of OpenAI’s chat models, is the response of the AI. Previous Assistant responses can be included in the chat history to provide context, especially if a conversation has back-and-forth elements. This helps the model generate coherent and contextually relevant responses in a multi-turn conversation.

---

## Learn more

- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](https://nx.app/)
