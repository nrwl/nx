import { FeedAnswer } from './feed-answer';
import { FeedQuestion } from './feed-question';
import { Message } from 'ai/react';

export function Feed({
  activity,
  onFeedback,
}: {
  activity: Message[];
  onFeedback: (statement: 'bad' | 'good', chatItemUid: string) => void;
}) {
  return (
    <div className="my-12 flow-root">
      <ul role="list" className="-mb-8 space-y-12">
        {activity.map((activityItem, activityItemIdx) => (
          <li
            key={[activityItem.role, activityItem.id].join('-')}
            className="feed-item relative flex items-start space-x-3 pt-12"
          >
            {activityItem.role === 'assistant' ? (
              <FeedAnswer
                content={activityItem.content}
                feedbackButtonCallback={(statement) =>
                  onFeedback(statement, activityItem.id)
                }
                isFirst={activityItemIdx === 0}
              />
            ) : (
              <FeedQuestion content={activityItem.content} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
