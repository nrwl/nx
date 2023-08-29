import { getProcessedHistory, queryAi } from '@nx/nx-dev/data-access-ai';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { RefObject, useEffect, useRef, useState } from 'react';
import { ErrorMessage } from './error-message';
import { Feed } from './feed/feed';
import { LoadingState } from './loading-state';
import { Prompt } from './prompt';
import { formatMarkdownSources } from './utils';
import { ChatItem } from '@nx/nx-dev/util-ai';

interface LastQueryMetadata {
  sources: string[];
  textResponse: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  } | null;
}

const assistantWelcome: ChatItem = {
  role: 'assistant',
  content:
    "👋 Hi, I'm your Nx Assistant. With my ocean of knowledge about Nx, I can answer your questions and guide you to the relevant documentation. What would you like to know?",
};

export function FeedContainer(): JSX.Element {
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const [queryError, setQueryError] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastQueryMetadata, setLastQueryMetadata] =
    useState<LastQueryMetadata | null>(null);

  const feedContainer: RefObject<HTMLDivElement> | undefined = useRef(null);

  useEffect(() => {
    if (feedContainer.current) {
      const elements =
        feedContainer.current.getElementsByClassName('feed-item');
      elements[elements.length - 1].scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isLoading]);

  const handleSubmit = async (query: string, currentHistory: ChatItem[]) => {
    if (!query) return;

    currentHistory.push({ role: 'user', content: query });

    setIsLoading(true);
    setQueryError(null);

    try {
      const lastAnswerChatItem =
        currentHistory.filter((item) => item.role === 'assistant').pop() ||
        null;
      // Use previous assistant's answer if it exists
      const aiResponse = await queryAi(
        query,
        lastAnswerChatItem ? lastAnswerChatItem.content : ''
      );
      // TODO: Save a list of metadata corresponding to each query
      // Saving Metadata for usage like feedback and analytics
      setLastQueryMetadata({
        sources: aiResponse.sources
          ? aiResponse.sources.map((source) => source.url)
          : [],
        textResponse: aiResponse.textResponse,
        usage: aiResponse.usage || null,
      });
      let content = aiResponse.textResponse;
      if (aiResponse.sourcesMarkdown.length !== 0)
        content += formatMarkdownSources(aiResponse.sourcesMarkdown);

      // Saving the new chat history used by AI for follow-up prompts
      setChatHistory([
        ...getProcessedHistory(),
        { role: 'assistant', content },
      ]);

      sendCustomEvent('ai_query', 'ai', 'query', undefined, {
        query,
        ...aiResponse.usage,
      });
    } catch (error: any) {
      setQueryError(error);
    }

    setIsLoading(false);
  };

  const handleFeedback = (statement: 'good' | 'bad', chatItemIndex: number) => {
    const question = chatHistory[chatItemIndex - 1];
    const answer = chatHistory[chatItemIndex];

    sendCustomEvent('ai_feedback', 'ai', statement, undefined, {
      query: question ? question.content : 'Could not retrieve the question',
      result: answer ? answer.content : 'Could not retrieve the answer',
      sources: lastQueryMetadata
        ? JSON.stringify(lastQueryMetadata.sources)
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
                  activity={
                    !!chatHistory.length ? chatHistory : [assistantWelcome]
                  }
                  handleFeedback={(statement, chatItemIndex) =>
                    handleFeedback(statement, chatItemIndex)
                  }
                />

                {isLoading && <LoadingState />}
                {queryError && <ErrorMessage error={queryError} />}

                <div className="sticky bottom-0 left-0 right-0 w-full pt-6 pb-4 bg-gradient-to-t from-white via-white dark:from-slate-900 dark:via-slate-900">
                  <Prompt
                    handleSubmit={(query) => handleSubmit(query, chatHistory)}
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
