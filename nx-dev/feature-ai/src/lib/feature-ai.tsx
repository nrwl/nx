import { ReactNode, useState } from 'react';
import { Button } from '@nx/nx-dev/ui-common';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';

import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { nxDevDataAccessAi } from '@nx/nx-dev/data-access-ai';

export function FeatureAi(): JSX.Element {
  const [finalResult, setFinalResult] = useState<null | ReactNode>(null);
  const [error, setError] = useState(null);
  const [query, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState('');

  const warning = `
  {% callout type="warning" title="Always double check!" %}
  This feature is still in Alpha.
  The results may not be accurate, so please always double check with our documentation.
{% /callout %}

  `;

  const handleSubmit = async () => {
    setLoading(true);
    let completeText = '';
    let usage;
    let sourcesMarkdown = '';
    try {
      const aiResponse = await nxDevDataAccessAi(query);
      completeText = aiResponse.textResponse;
      usage = aiResponse.usage;
      setSources(
        JSON.stringify(aiResponse.sources?.map((source) => source.url))
      );
      sourcesMarkdown = aiResponse.sourcesMarkdown;
      setLoading(false);
    } catch (error) {
      setError(error as any);
      setLoading(false);
    }
    sendCustomEvent('ai_query', 'ai', 'query', undefined, {
      query,
      ...usage,
    });

    const sourcesMd = `
  {% callout type="info" title="Sources" %}
  ${sourcesMarkdown}
  {% /callout %}`;

    setFinalResult(
      renderMarkdown(warning + completeText + sourcesMd, { filePath: '' }).node
    );
  };

  return (
    <div
      className="p-2 mx-auto flex h-full w-full flex-col"
      id="wrapper"
      data-testid="wrapper"
    >
      <div className="w-full flex">
        <input
          id="search"
          name="search"
          disabled={loading}
          className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-slate-500 transition focus:placeholder-slate-400 dark:border-slate-900 dark:bg-slate-700"
          placeholder="What do you want to know?"
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.keyCode === 13 || event.key === 'Enter') {
              handleSubmit();
            }
          }}
          type="search"
        />
        <Button
          variant="primary"
          size="small"
          disabled={loading}
          onClick={() => handleSubmit()}
        >
          Ask
        </Button>
      </div>
      {loading ? (
        <div className="p-4 max-w-none">
          <h1>Thinking...</h1>
        </div>
      ) : null}
      {finalResult && !error ? (
        <>
          <div className="p-4 max-w-none prose prose-slate dark:prose-invert">
            {finalResult}
          </div>
          <div>
            <Button
              variant="primary"
              size="small"
              onClick={() =>
                sendCustomEvent('ai_feedback', 'ai', 'good', undefined, {
                  query,
                  result: finalResult,
                  sources,
                })
              }
            >
              Answer was helpful{' '}
              <span role="img" aria-label="thumbs-up">
                👍
              </span>
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={() =>
                sendCustomEvent('ai_feedback', 'ai', 'bad', undefined, {
                  query,
                  result: finalResult,
                  sources,
                })
              }
            >
              Answer looks wrong{' '}
              <span role="img" aria-label="thumbs-down">
                👎
              </span>
            </Button>
          </div>
        </>
      ) : null}
      {error ? <div>There was an error: {error['message']}</div> : null}
    </div>
  );
}

export default FeatureAi;
