import { ChatItem } from '@nx/nx-dev/util-ai';
import { FeedAnswer } from './feed-answer';
import { FeedQuestion } from './feed-question';

export function Feed({
  activity,
  handleFeedback,
}: {
  activity: ChatItem[];
  handleFeedback: (statement: 'bad' | 'good', chatItemIndex: number) => void;
}) {
  return (
    <div className="flow-root my-12">
      <ul role="list" className="-mb-8 space-y-12">
        {activity.map((activityItem, activityItemIdx) => (
          <li
            key={[activityItem.role, activityItemIdx].join('-')}
            className="pt-12 relative flex items-start space-x-3 feed-item"
          >
            {activityItem.role === 'assistant' ? (
              <FeedAnswer
                content={activityItem.content}
                feedbackButtonCallback={(statement) =>
                  handleFeedback(statement, activityItemIdx)
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
