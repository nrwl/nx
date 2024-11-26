import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import {
  type FormEvent,
  type JSX,
  RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ErrorMessage } from './error-message';
import { Feed } from './feed/feed';
import { LoadingState } from './loading-state';
import { Prompt } from './prompt';
import { getQueryFromUid, storeQueryForUid } from '@nx/nx-dev/util-ai';
import { Message, useChat } from 'ai/react';
import { cx } from '@nx/nx-dev/ui-primitives';

const assistantWelcome: Message = {
  id: 'first-custom-message',
  role: 'assistant',
  content:
    "👋 Hi, I'm your Nx Assistant. With my ocean of knowledge about Nx, I can answer your questions and guide you to the relevant documentation. What would you like to know?",
};

export function FeedContainer(): JSX.Element {
  const [error, setError] = useState<Error | null>(null);
  const [startedReply, setStartedReply] = useState(false);
  const [isStopped, setStopped] = useState(false);

  const {
    messages,
    setMessages,
    input,
    handleInputChange,
    handleSubmit: _handleSubmit,
    stop,
    reload,
    isLoading,
  } = useChat({
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

  /*
   * Determine whether we should scroll to the bottom of new messages.
   * Scroll if:
   * 1. New message has come in (length > previous length)
   * 2. User is close to the bottom of the messages
   *
   * Otherwise, user is probably reading messages, so don't scroll.
   */
  const scrollableWrapperRef: RefObject<HTMLDivElement> | undefined =
    useRef(null);
  const currentMessagesLength = useRef(0);
  useEffect(() => {
    if (!scrollableWrapperRef.current) return;
    const el = scrollableWrapperRef.current;
    let shouldScroll = false;
    if (messages.length > currentMessagesLength.current) {
      currentMessagesLength.current = messages.length;
      shouldScroll = true;
    } else if (el.scrollTop + el.clientHeight + 50 >= el.scrollHeight) {
      shouldScroll = true;
    }
    if (shouldScroll) el.scrollTo(0, el.scrollHeight);
  }, [messages, isLoading]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setStopped(false);
    _handleSubmit(event);
  };

  const handleNewChat = () => {
    setMessages([]);
    setError(null);
    setStartedReply(false);
    setStopped(false);
  };

  const handleFeedback = (statement: 'good' | 'bad', chatItemUid: string) => {
    const query = getQueryFromUid(chatItemUid);
    sendCustomEvent('ai_feedback', 'ai', statement, undefined, {
      query: query ?? 'Could not retrieve the question',
    });
  };

  const handleStopGenerating = () => {
    setStopped(true);
    stop();
  };

  const handleRegenerate = () => {
    setStopped(false);
    reload();
  };

  return (
    <>
      {/*WRAPPER*/}
      <div
        ref={scrollableWrapperRef}
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
              <div data-document="main" className="relative pb-36">
                <Feed
                  activity={!!messages.length ? messages : [assistantWelcome]}
                  onFeedback={handleFeedback}
                />

                {/* Change this message if it's loading but it's writing as well  */}
                {isLoading && !startedReply && <LoadingState />}
                {error && <ErrorMessage error={error} />}

                <div
                  className={cx(
                    'left0 fixed bottom-0 right-0 w-full px-4 py-4 lg:px-0 lg:py-6',
                    'bg-gradient-to-t from-white via-white/75 dark:from-slate-900 dark:via-slate-900/75'
                  )}
                >
                  <Prompt
                    onSubmit={handleSubmit}
                    onInputChange={handleInputChange}
                    onNewChat={handleNewChat}
                    onStopGenerating={handleStopGenerating}
                    onRegenerate={handleRegenerate}
                    input={input}
                    isGenerating={isLoading}
                    showNewChatCta={!isLoading && messages.length > 0}
                    showRegenerateCta={isStopped}
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
