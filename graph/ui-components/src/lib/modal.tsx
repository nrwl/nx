// component from https://tailwindui.com/components/application-ui/overlays/dialogs
import { Dialog, Transition } from '@headlessui/react';
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
    ref: ForwardedRef<ModalHandle>
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
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end items-center justify-center p-4 text-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel
                  className={`relative mx-4 my-8 w-full transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all md:max-w-5xl xl:max-w-7xl dark:bg-slate-900
                  `}
                >
                  <div className="flex items-center justify-between rounded-t border-b bg-white p-2 pb-1 md:p-4 md:pb-2 dark:border-gray-600 dark:bg-slate-900">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 dark:text-slate-200"
                    >
                      {title}
                    </Dialog.Title>
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
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    );
  }
);
