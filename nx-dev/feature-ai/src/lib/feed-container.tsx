import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { RefObject, useEffect, useRef, useState } from 'react';
import { ErrorMessage } from './error-message';
import { Feed } from './feed/feed';
import { LoadingState } from './loading-state';
import { Prompt } from './prompt';
import { ChatItem, extractLinksFromSourcesSection } from '@nx/nx-dev/util-ai';
import { Message, useChat } from 'ai/react';

const assistantWelcome: ChatItem = {
  role: 'assistant',
  content:
    "👋 Hi, I'm your Nx Assistant. With my ocean of knowledge about Nx, I can answer your questions and guide you to the relevant documentation. What would you like to know?",
};

export function FeedContainer(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);
  const [startedReply, setStartedReply] = useState(false);
  const [sources, setSources] = useState<string[]>([]);

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
        setSources(extractLinksFromSourcesSection(response.content));
        // Here we have the message id and the timestamp, so we can create a linked list
      },
    });

  useEffect(() => {
    if (feedContainer.current) {
      const elements =
        feedContainer.current.getElementsByClassName('feed-item');
      elements[elements.length - 1].scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleFeedback = (statement: 'good' | 'bad', chatItemIndex: number) => {
    // TODO(katerina): Fix this - Read on
    // This is wrong
    // We have to make sure to send the query for the actual message that was clicked
    // Here we are just sending the last one
    const question = messages[chatItemIndex - 1];
    const answer = messages[chatItemIndex];

    sendCustomEvent('ai_feedback', 'ai', statement, undefined, {
      query: question ? question.content : 'Could not retrieve the question',
      result: answer ? answer.content : 'Could not retrieve the answer',
      sources: sources
        ? JSON.stringify(sources)
        : 'Could not retrieve last answer sources',
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
                  handleFeedback={(statement, chatItemIndex) =>
                    handleFeedback(statement, chatItemIndex)
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
