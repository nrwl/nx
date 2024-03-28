// component from https://tailwindui.com/components/application-ui/overlays/dialogs
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  ForwardedRef,
  Fragment,
  ReactNode,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';

export interface ModalProps {
  children: ReactNode; // modal content
  title: string; // modal title
}

export interface ModalHandle {
  openModal: () => void;
  closeModal: () => void;
}

export const Modal = forwardRef(
  ({ children, title }: ModalProps, ref: ForwardedRef<ModalHandle>) => {
    const [open, setOpen] = useState(false);

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
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                  <div className="flex items-center justify-between p-2 pb-1 md:p-4 md:pb-2 border-b rounded-t dark:border-gray-600">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      {title}
                    </Dialog.Title>
                    <button
                      type="button"
                      className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                      data-modal-hide="default-modal"
                      onClick={() => setOpen(false)}
                    >
                      <XMarkIcon />
                      <span className="sr-only">Close modal</span>
                    </button>
                  </div>
                  <div className="bg-white p-2 md:p-4">{children}</div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    );
  }
);
