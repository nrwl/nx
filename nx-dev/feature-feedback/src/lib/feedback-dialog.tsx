import { Dialog, Transition } from '@headlessui/react';
import { ChangeEvent, Fragment, useMemo, useState } from 'react';
import { GithubIcon } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';

import styles from './feature-feedback.module.css';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFeedbackSubmit: (feedback: string) => void;
}

function FeedbackDialog({
  isOpen,
  onClose,
  onFeedbackSubmit,
}: FeedbackDialogProps) {
  let [isIdea, setShowIdea] = useState<boolean | null>(null);
  let [feedback, setFeedback] = useState('');

  const formDisabled = useMemo(() => feedback.trim() === '', [feedback]);

  // since HTMLInputElement type does not come with value we can add it to the type
  function handleFeedbackSelectionChange(
    event: ChangeEvent<HTMLInputElement> & { currentTarget: { value: string } }
  ) {
    setShowIdea(event.currentTarget.value === 'idea');
  }

  function updateFeedback(
    event: ChangeEvent<HTMLTextAreaElement> & {
      currentTarget: { value: string };
    }
  ) {
    setFeedback(event.currentTarget.value);
  }

  function submitFeedback() {
    if (feedback) {
      onFeedbackSubmit(feedback);
    }
    closeDialog();
  }

  function keydownHandler(e: React.BaseSyntheticEvent) {
    if ((e.nativeEvent as React.KeyboardEvent).code === 'Space') {
      setShowIdea(true);
    }
  }

  function closeDialog() {
    setShowIdea(null);
    setFeedback('');
    onClose();
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog open={isOpen} onClose={closeDialog} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          {/* This is the backdrop */}
          <div
            className="fixed inset-0 bg-black/10 backdrop-blur-sm dark:bg-white/10"
            aria-hidden="true"
          />
        </Transition.Child>

        {/* This is the modal */}
        <div className="fixed inset-0 w-full overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-slate-900">
                <Dialog.Title
                  as="h3"
                  className="bg-white p-4 text-center text-lg font-medium leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-400"
                >
                  What is on your mind?
                  <button className={styles.closebutton} onClick={closeDialog}>
                    &times;
                  </button>
                </Dialog.Title>

                {/* The anatomy here should be
              
            ************* [Title] *********[Close button] *************
                    [ Github feedback] | [ Idea feedback ]
                    [ Feedback text area ]
                                        [ Done button ]
              These should be buttons that open a new tab to the respective feedback form

            - The Idea feedback opens up a textarea and a submit/done button
            - The Github feedback opens up a new tab to the Github issues page
         */}
                <ul className="grid w-full gap-6 pb-10 md:grid-cols-2">
                  <li>
                    <a
                      id="github"
                      aria-hidden="true"
                      href="https://github.com/nrwl/nx/issues/new?assignees=&labels=type%3A+docs&template=3-documentation.md"
                      target="_blank"
                      rel="noreferrer"
                      title="Report an issue on GitHub"
                      onClick={() => setShowIdea(false)}
                    >
                      <label
                        htmlFor="github"
                        className="inline-flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-5 text-gray-500 hover:bg-gray-100 hover:text-gray-600 peer-checked:border-blue-600 peer-checked:text-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:peer-checked:text-blue-500"
                      >
                        <div className="block">
                          <div className="w-full text-lg font-semibold">
                            GitHub
                          </div>
                          <div className="w-full">Found an issue?</div>
                        </div>
                        <GithubIcon className="h-14 w-14" />
                      </label>
                    </a>
                  </li>
                  <li>
                    <input
                      type="radio"
                      id="idea"
                      name="feedback_selection"
                      value="idea"
                      className="peer hidden"
                      checked={isIdea !== null && isIdea}
                      onChange={handleFeedbackSelectionChange}
                    />
                    <label
                      htmlFor="idea"
                      tabIndex={0}
                      onKeyDown={(e) => keydownHandler(e)}
                      className="inline-flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-5 text-gray-500 hover:bg-slate-50 focus:outline-none focus:ring-1 peer-checked:border-sky-500 peer-checked:text-sky-500 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-400 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800 dark:hover:text-gray-300 dark:peer-checked:text-sky-500"
                    >
                      <div className="block">
                        <div className="w-full text-lg font-semibold">Idea</div>
                        <div className="w-full">I have a suggestion!</div>
                      </div>
                      <svg
                        width="14px"
                        height="14px"
                        className="h-full w-14"
                        viewBox="0 0 14 14"
                        version="1.1"
                      >
                        <g>
                          <path
                            stroke="none"
                            fillRule="nonzero"
                            fill="currentColor"
                            fillOpacity="1"
                            d="M 7.171875 2.777344 C 5.117188 2.777344 3.441406 4.449219 3.441406 6.503906 C 3.441406 7.347656 3.71875 8.140625 4.242188 8.804688 C 4.339844 8.929688 4.449219 9.054688 4.554688 9.175781 C 4.863281 9.539062 5.15625 9.878906 5.261719 10.261719 C 5.265625 10.269531 5.285156 10.351562 5.28125 10.625 L 5.28125 10.664062 C 5.277344 10.886719 5.273438 11.191406 5.5 11.421875 C 5.652344 11.578125 5.867188 11.652344 6.160156 11.652344 L 8.175781 11.652344 C 8.488281 11.652344 8.714844 11.574219 8.863281 11.417969 C 9.066406 11.203125 9.054688 10.929688 9.046875 10.746094 C 9.042969 10.714844 9.042969 10.679688 9.042969 10.648438 C 9.039062 10.375 9.058594 10.296875 9.058594 10.292969 C 9.164062 9.910156 9.511719 9.507812 9.8125 9.148438 C 9.914062 9.03125 10.011719 8.917969 10.097656 8.804688 C 10.621094 8.144531 10.898438 7.347656 10.898438 6.503906 C 10.898438 4.449219 9.226562 2.777344 7.171875 2.777344 Z M 9.511719 8.339844 C 9.429688 8.441406 9.339844 8.550781 9.242188 8.664062 C 8.886719 9.078125 8.488281 9.550781 8.335938 10.09375 C 8.316406 10.171875 8.285156 10.3125 8.289062 10.65625 C 8.292969 10.699219 8.292969 10.742188 8.296875 10.78125 C 8.296875 10.816406 8.300781 10.859375 8.300781 10.894531 C 8.273438 10.898438 8.234375 10.902344 8.175781 10.902344 L 6.160156 10.902344 C 6.09375 10.902344 6.058594 10.894531 6.039062 10.890625 C 6.027344 10.839844 6.03125 10.738281 6.03125 10.675781 L 6.03125 10.632812 C 6.035156 10.285156 6.007812 10.144531 5.988281 10.066406 C 5.835938 9.515625 5.457031 9.078125 5.121094 8.6875 C 5.019531 8.566406 4.921875 8.453125 4.832031 8.339844 C 4.414062 7.8125 4.195312 7.175781 4.195312 6.503906 C 4.195312 4.863281 5.53125 3.527344 7.171875 3.527344 C 8.8125 3.527344 10.148438 4.863281 10.148438 6.503906 C 10.148438 7.175781 9.925781 7.8125 9.511719 8.339844 Z M 9.511719 8.339844 "
                          />
                          <path
                            stroke="none"
                            fillRule="nonzero"
                            fill="currentColor"
                            fillOpacity="1"
                            d="M 8.097656 11.992188 L 6.242188 11.992188 C 5.84375 11.992188 5.515625 12.316406 5.515625 12.71875 L 5.515625 13.273438 C 5.515625 13.675781 5.84375 14 6.242188 14 L 8.097656 14 C 8.496094 14 8.824219 13.675781 8.824219 13.273438 L 8.824219 12.71875 C 8.824219 12.316406 8.496094 11.992188 8.097656 11.992188 Z M 8.074219 13.25 L 6.269531 13.25 L 6.269531 12.742188 L 8.074219 12.742188 Z M 8.074219 13.25 "
                          />
                          <path
                            stroke="none"
                            fillRule="nonzero"
                            fill="currentColor"
                            fillOpacity="1"
                            d="M 7.171875 2.292969 C 7.378906 2.292969 7.546875 2.125 7.546875 1.917969 L 7.546875 0.375 C 7.546875 0.167969 7.378906 0 7.171875 0 C 6.964844 0 6.796875 0.167969 6.796875 0.375 L 6.796875 1.917969 C 6.796875 2.125 6.964844 2.292969 7.171875 2.292969 Z M 7.171875 2.292969 "
                          />
                          <path
                            stroke="none"
                            fillRule="nonzero"
                            fill="currentColor"
                            fillOpacity="1"
                            d="M 12.109375 1.730469 C 11.964844 1.582031 11.730469 1.578125 11.578125 1.71875 L 10.4375 2.808594 C 10.289062 2.949219 10.285156 3.1875 10.425781 3.339844 C 10.5 3.414062 10.597656 3.453125 10.699219 3.453125 C 10.792969 3.453125 10.882812 3.417969 10.957031 3.351562 L 12.097656 2.261719 C 12.246094 2.121094 12.253906 1.882812 12.109375 1.730469 Z M 12.109375 1.730469 "
                          />
                          <path
                            stroke="none"
                            fillRule="nonzero"
                            fill="currentColor"
                            fillOpacity="1"
                            d="M 13.230469 5.484375 C 13.226562 5.484375 13.226562 5.484375 13.226562 5.484375 L 11.761719 5.488281 C 11.554688 5.488281 11.386719 5.65625 11.386719 5.863281 C 11.386719 6.070312 11.554688 6.238281 11.761719 6.238281 L 13.230469 6.238281 C 13.4375 6.238281 13.605469 6.066406 13.605469 5.859375 C 13.605469 5.652344 13.4375 5.484375 13.230469 5.484375 Z M 13.230469 5.484375 "
                          />
                          <path
                            stroke="none"
                            fillRule="nonzero"
                            fill="currentColor"
                            fillOpacity="1"
                            d="M 3.722656 3.238281 C 3.867188 3.089844 3.859375 2.851562 3.710938 2.707031 L 2.570312 1.621094 C 2.421875 1.476562 2.183594 1.480469 2.039062 1.632812 C 1.898438 1.78125 1.902344 2.019531 2.054688 2.164062 L 3.191406 3.25 C 3.265625 3.320312 3.359375 3.355469 3.453125 3.355469 C 3.550781 3.355469 3.648438 3.316406 3.722656 3.238281 Z M 3.722656 3.238281 "
                          />
                          <path
                            stroke="none"
                            fillRule="nonzero"
                            fill="currentColor"
                            fillOpacity="1"
                            d="M 2.238281 5.488281 L 0.773438 5.484375 C 0.773438 5.484375 0.769531 5.484375 0.769531 5.484375 C 0.5625 5.484375 0.394531 5.652344 0.394531 5.859375 C 0.394531 6.066406 0.5625 6.238281 0.769531 6.238281 L 2.238281 6.238281 C 2.445312 6.238281 2.613281 6.070312 2.613281 5.863281 C 2.613281 5.65625 2.445312 5.488281 2.238281 5.488281 Z M 2.238281 5.488281 "
                          />
                        </g>
                      </svg>
                    </label>
                  </li>
                </ul>
                {isIdea && (
                  <div className={styles.fadeinout}>
                    <Dialog.Description>
                      We are always looking to improve our documentation. If you
                      have any suggestions, please let us know.
                    </Dialog.Description>
                    <Dialog.Description className="pt-4">
                      <textarea
                        rows={5}
                        className="box-border w-full rounded dark:bg-gray-800"
                        required
                        value={feedback}
                        onChange={updateFeedback}
                      ></textarea>
                    </Dialog.Description>
                    <Dialog.Description className="relative mt-4 flex justify-end rounded-l-md">
                      <button
                        onClick={submitFeedback}
                        disabled={formDisabled}
                        className={cx(
                          'rounded-md border border-slate-200 bg-white px-4 py-2 text-base font-medium text-slate-600  dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400',
                          { 'cursor-not-allowed': formDisabled },
                          {
                            'focus-within:ring-blue-500 hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-1 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800':
                              !formDisabled,
                          }
                        )}
                      >
                        Done
                      </button>
                    </Dialog.Description>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default FeedbackDialog;
export { FeedbackDialog };
