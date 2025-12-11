// component from https://tailwindui.com/components/application-ui/overlays/dialogs
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  ForwardedRef,
  Fragment,
  ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

export interface ModalProps {
  children: ReactNode;
  title: string;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface ModalHandle {
  openModal: () => void;
  closeModal: () => void;
}

export const Modal = forwardRef(
  (
    { children, title, onOpen, onClose }: ModalProps,
    ref: ForwardedRef<ModalHandle | undefined>
  ) => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      if (open) {
        onOpen?.();
      } else {
        onClose?.();
      }
    }, [open, onOpen, onClose]);

    useImperativeHandle(ref, () => ({
      closeModal: () => {
        setOpen(false);
      },
      openModal: () => {
        setOpen(true);
      },
    }));

    return (
      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-[9999]" onClose={setOpen}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500/75 transition-opacity" />
          </TransitionChild>

          <div className="fixed inset-0 z-[9999] w-screen overflow-y-auto">
            <div className="flex h-full min-h-full items-end items-center justify-center p-4 text-center sm:p-0">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <DialogPanel
                  className={`relative mx-4 my-8 w-full transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all md:max-w-5xl xl:max-w-7xl dark:bg-slate-900`}
                >
                  <div className="flex items-center justify-between rounded-t border-b bg-white p-2 pb-1 md:p-4 md:pb-2 dark:border-gray-600 dark:bg-slate-900">
                    <DialogTitle
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 dark:text-slate-200"
                    >
                      {title}
                    </DialogTitle>
                    <button
                      type="button"
                      className="ms-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
                      data-modal-hide="default-modal"
                      onClick={() => setOpen(false)}
                    >
                      <XMarkIcon />
                      <span className="sr-only">Close modal</span>
                    </button>
                  </div>
                  <div className="max-h-[90vh] overflow-y-auto bg-white p-2 md:p-4 dark:bg-slate-900">
                    {children}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }
);
