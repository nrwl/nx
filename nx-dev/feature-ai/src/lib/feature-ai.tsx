import { ReactNode, useState } from 'react';
import { Button } from '@nx/nx-dev/ui-common';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import {
  nxDevDataAccessAi,
  resetHistory,
  getProcessedHistory,
  ChatItem,
} from '@nx/nx-dev/data-access-ai';

export function FeatureAi(): JSX.Element {
  const [chatHistory, setChatHistory] = useState<ChatItem[] | null>([]);
  const [finalResult, setFinalResult] = useState<null | ReactNode>(null);
  const [textResponse, setTextResponse] = useState<undefined | string>('');
  const [error, setError] = useState(null);
  const [query, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const [sources, setSources] = useState('');

  const warning = renderMarkdown(
    `
  {% callout type="warning" title="Always double check!" %}
  This feature is still in Alpha.
  The results may not be accurate, so please always double check with our documentation.
{% /callout %}
  `,
    { filePath: '' }
  ).node;

  const infoBox = renderMarkdown(
    `
  {% callout type="info" title="New question or continue chat?" %}
  This chat has memory. It will answer all it's questions in the context of the previous questions.
  If you want to ask a new question, you can reset the chat history with the button below.
  {% /callout %}
  `,
    { filePath: '' }
  ).node;

  const handleSubmit = async () => {
    if (textResponse) {
      setChatHistory([
        ...(chatHistory ?? []),
        { role: 'assistant', content: textResponse },
      ]);
    }
    setLoading(true);
    setError(null);
    let completeText = '';
    let usage;
    let sourcesMarkdown = '';
    try {
      const aiResponse = await nxDevDataAccessAi(query, textResponse);
      completeText = aiResponse.textResponse;
      setTextResponse(completeText);
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
    setChatHistory(getProcessedHistory());
    sendCustomEvent('ai_query', 'ai', 'query', undefined, {
      query,
      ...usage,
    });
    setFeedbackSent(false);

    const sourcesMd = `
  {% callout type="info" title="Sources" %}
  ${sourcesMarkdown}
  {% /callout %}`;

    setFinalResult(
      renderMarkdown(completeText + sourcesMd, { filePath: '' }).node
    );
  };

  const handleReset = () => {
    resetHistory();
    setFinalResult(null);
    setSearchTerm('');
    setTextResponse('');
    setSources('');
    setFeedbackSent(false);
    setChatHistory(null);
  };

  const handleFeedback = (type: 'good' | 'bad') => {
    try {
      sendCustomEvent('ai_feedback', 'ai', type, undefined, {
        query,
        result: finalResult,
        sources,
      });
      setFeedbackSent(true);
    } catch (error) {
      setFeedbackSent(false);
    }
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
      <div>
        {infoBox}
        <Button variant="primary" size="small" onClick={() => handleReset()}>
          Ask new question{' '}
          <span role="img" aria-label="thumbs-down">
            🔄
          </span>
        </Button>
        {warning}
      </div>
      {loading ? (
        <div className="p-4 max-w-none">
          <h1>Thinking...</h1>
        </div>
      ) : null}

      {chatHistory ? (
        <div className="p-4 bg-gray-100">
          <div className="mx-auto bg-white p-6 rounded shadow">
            {chatHistory.length > 30 && (
              <div>
                You've reached the maximum message history limit. Some previous
                messages will be removed. You can always start a new chat.
              </div>
            )}
            <p>HISTORY</p>
            {chatHistory.map((chatItem, index) => (
              <div key={index} className="mb-4 border-b pb-2">
                <strong className="text-gray-700 capitalize">
                  {chatItem.role}:
                </strong>
                <p className="text-gray-600 mt-1">{chatItem.content}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {finalResult && !loading && !error ? (
        <>
          <div className="p-4 max-w-none prose prose-slate dark:prose-invert">
            {finalResult}
          </div>
          {!feedbackSent && (
            <div>
              <Button
                variant="primary"
                size="small"
                onClick={() => handleFeedback('good')}
              >
                Answer was helpful{' '}
                <span role="img" aria-label="thumbs-up">
                  👍
                </span>
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={() => handleFeedback('bad')}
              >
                Answer looks wrong{' '}
                <span role="img" aria-label="thumbs-down">
                  👎
                </span>
              </Button>
            </div>
          )}
          {feedbackSent && (
            <p>
              <span role="img" aria-label="check">
                ✅
              </span>{' '}
              Thank you for your feedback!
            </p>
          )}
        </>
      ) : null}
      {error && !loading ? (
        <div>There was an error: {error['message']}</div>
      ) : null}
    </div>
  );
}

export default FeatureAi;
