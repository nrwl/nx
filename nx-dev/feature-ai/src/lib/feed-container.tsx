import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { RefObject, useEffect, useRef, useState } from 'react';
import { ErrorMessage } from './error-message';
import { Feed } from './feed/feed';
import { LoadingState } from './loading-state';
import { Prompt } from './prompt';
import { getQueryFromUid, storeQueryForUid } from '@nx/nx-dev/util-ai';
import { Message, useChat } from 'ai/react';

const assistantWelcome: Message = {
  id: 'first-custom-message',
  role: 'assistant',
  content:
    "👋 Hi, I'm your Nx Assistant. With my ocean of knowledge about Nx, I can answer your questions and guide you to the relevant documentation. What would you like to know?",
};

export function FeedContainer(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);
  const [startedReply, setStartedReply] = useState(false);

  const feedContainer: RefObject<HTMLDivElement> | undefined = useRef(null);
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: '/api/query-ai-handler',
      onError: (error) => {
        setError(error);
      },
      onResponse: (_response) => {
        setStartedReply(true);
        sendCustomEvent('ai_query', 'ai', 'query', undefined, {
          query: input,
        });
        setError(null);
      },
      onFinish: (response: Message) => {
        setStartedReply(false);
        storeQueryForUid(response.id, input);
      },
    });

  useEffect(() => {
    if (feedContainer.current) {
      const elements =
        feedContainer.current.getElementsByClassName('feed-item');
      elements[elements.length - 1].scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleFeedback = (statement: 'good' | 'bad', chatItemUid: string) => {
    const query = getQueryFromUid(chatItemUid);
    sendCustomEvent('ai_feedback', 'ai', statement, undefined, {
      query: query ?? 'Could not retrieve the question',
    });
  };

  return (
    <>
      {/*WRAPPER*/}
      <div
        id="wrapper"
        data-testid="wrapper"
        className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
      >
        <div className="mx-auto w-full grow items-stretch px-4 sm:px-8 lg:max-w-4xl">
          <div
            id="content-wrapper"
            className="w-full flex-auto flex-grow flex-col"
          >
            <div className="relative min-w-0 flex-auto">
              {/*MAIN CONTENT*/}
              <div
                ref={feedContainer}
                data-document="main"
                className="relative"
              >
                <Feed
                  activity={!!messages.length ? messages : [assistantWelcome]}
                  handleFeedback={(statement, chatItemUid) =>
                    handleFeedback(statement, chatItemUid)
                  }
                />

                {/* Change this message if it's loading but it's writing as well  */}
                {isLoading && !startedReply && <LoadingState />}
                {error && <ErrorMessage error={error} />}

                <div className="sticky bottom-0 left-0 right-0 w-full pt-6 pb-4 bg-gradient-to-t from-white via-white dark:from-slate-900 dark:via-slate-900">
                  <Prompt
                    handleSubmit={handleSubmit}
                    handleInputChange={handleInputChange}
                    input={input}
                    isDisabled={isLoading}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
