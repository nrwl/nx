import { useEffect, useRef, useState } from 'react';
import { Button } from '@nx/nx-dev/ui-common';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import {
  nxDevDataAccessAi,
  resetHistory,
  getProcessedHistory,
  ChatItem,
  handleFeedback,
  handleQueryReporting,
} from '@nx/nx-dev/data-access-ai';
import { warning, infoBox, noResults } from './utils';

export function FeatureAi(): JSX.Element {
  const [chatHistory, setChatHistory] = useState<ChatItem[] | null>([]);
  const [textResponse, setTextResponse] = useState<undefined | string>('');
  const [error, setError] = useState(null);
  const [query, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<number, boolean>>({});
  const [sources, setSources] = useState('');
  const [input, setInput] = useState('');
  const lastMessageRef: React.RefObject<HTMLDivElement> | undefined =
    useRef(null);

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSubmit = async () => {
    setInput('');
    if (query) {
      setChatHistory([
        ...(chatHistory ?? []),
        { role: 'user', content: query },
        { role: 'assistant', content: 'Let me think about that...' },
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
    } catch (error: any) {
      setError(error);
      setLoading(false);
    }
    sendCustomEvent('ai_query', 'ai', 'query', undefined, {
      query,
    });
    handleQueryReporting({
      action: 'ai_query',
      query,
      ...usage,
    });
    const sourcesMd =
      sourcesMarkdown.length === 0
        ? ''
        : `
\n
{% callout type="info" title="Sources" %}
${sourcesMarkdown}
{% /callout %}
\n
        `;

    if (completeText) {
      setChatHistory([
        ...getProcessedHistory(),
        { role: 'assistant', content: completeText + sourcesMd },
      ]);
    }
  };

  const handleUserFeedback = (result: 'good' | 'bad', index: number) => {
    try {
      sendCustomEvent('ai_feedback', 'ai', result);
      handleFeedback({
        action: 'evaluation',
        result,
        query,
        response: textResponse,
        sources,
      });
      setFeedbackSent((prev) => ({ ...prev, [index]: true }));
    } catch (error) {
      setFeedbackSent((prev) => ({ ...prev, [index]: false }));
    }
  };

  const handleReset = () => {
    resetHistory();
    setSearchTerm('');
    setTextResponse('');
    setSources('');
    setChatHistory(null);
    setInput('');
    setFeedbackSent({});
  };

  return (
    <div
      className="p-2 mx-auto flex h-screen w-full flex-col h-[calc(100vh-150px)]"
      id="wrapper"
      data-testid="wrapper"
    >
      <div className="flex-1 overflow-y-auto mb-4">
        <div>
          {infoBox}
          {warning}
        </div>
        {chatHistory && renderChatHistory(chatHistory)}
      </div>
      {renderChatInput()}
    </div>
  );

  function renderChatHistory(history: ChatItem[]) {
    return (
      <div className="mx-auto bg-white p-6 rounded shadow flex flex-col">
        {history.length > 30 && (
          <div>
            You've reached the maximum message history limit. Some previous
            messages will be removed. You can always start a new chat.
          </div>
        )}{' '}
        {history.map((chatItem, index) =>
          renderChatItem(chatItem, index, history.length)
        )}
      </div>
    );
  }

  function renderChatItem(
    chatItem: ChatItem,
    index: number,
    historyLength: number
  ) {
    return (
      <div
        key={index}
        ref={index === historyLength - 1 ? lastMessageRef : null}
        className={` p-2 m-2 rounded-lg ${
          chatItem.role === 'assistant' ? 'bg-blue-200' : 'bg-gray-300'
        } ${chatItem.role === 'user' ? 'text-right' : ''} ${
          chatItem.role === 'user' ? 'self-end' : ''
        }`}
      >
        {chatItem.role === 'assistant' && (
          <strong className="text-gray-700">
            nx assistant{' '}
            <span role="img" aria-label="Narwhal">
              🐳
            </span>
          </strong>
        )}
        {((chatItem.role === 'assistant' && !error) ||
          chatItem.role === 'user') && (
          <div className="text-gray-600 mt-1">
            {renderMarkdown(chatItem.content, { filePath: '' }).node}
          </div>
        )}
        {chatItem.role === 'assistant' &&
          !error &&
          chatHistory?.length &&
          (index === chatHistory.length - 1 && loading ? null : !feedbackSent[
              index
            ] ? (
            <div>
              <Button
                variant="primary"
                size="small"
                onClick={() => handleUserFeedback('good', index)}
              >
                Answer was helpful{' '}
                <span role="img" aria-label="thumbs-up">
                  👍
                </span>
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={() => handleUserFeedback('bad', index)}
              >
                Answer looks wrong{' '}
                <span role="img" aria-label="thumbs-down">
                  👎
                </span>
              </Button>
            </div>
          ) : (
            <p>
              <span role="img" aria-label="check">
                ✅
              </span>{' '}
              Thank you for your feedback!
            </p>
          ))}

        {error && !loading && chatItem.role === 'assistant' ? (
          error['data']?.['no_results'] ? (
            noResults
          ) : (
            <div>There was an error: {error['message']}</div>
          )
        ) : null}
      </div>
    );
  }

  function renderChatInput() {
    return (
      <div className="flex gap-2 fixed bottom-0 left-0 right-0 p-4 bg-white">
        <input
          id="search"
          name="search"
          value={input}
          disabled={loading}
          className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-slate-500 transition focus:placeholder-slate-400 dark:border-slate-900 dark:bg-slate-700"
          placeholder="What do you want to know?"
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setInput(event.target.value);
          }}
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
        <Button variant="secondary" size="small" onClick={() => handleReset()}>
          Ask new question{' '}
          <span role="img" aria-label="new question">
            🔄
          </span>
        </Button>
      </div>
    );
  }
}

export default FeatureAi;
