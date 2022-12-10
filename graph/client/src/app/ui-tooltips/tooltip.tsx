import {
  Attributes,
  cloneElement,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  arrow,
  flip,
  offset,
  Placement,
  ReferenceType,
  shift,
  useFloating,
} from '@floating-ui/react-dom';

export type TooltipProps = HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  content: ReactNode;
  children?: ReactElement;
  placement?: Placement;
  reference?: ReferenceType;
  openAction?: 'click' | 'hover' | 'manual';
};

export function Tooltip({
  children,
  open = false,
  content,
  placement = 'top',
  reference: externalReference,
  openAction = 'click',
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(open);
  const arrowRef = useRef(null);
  const {
    x,
    y,
    reference,
    floating,
    strategy,
    placement: finalPlacement,
    middlewareData: { arrow: { x: arrowX, y: arrowY } = {} },
  } = useFloating({
    placement,
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 6 }),
      arrow({ element: arrowRef }),
    ],
  });

  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[finalPlacement.split('-')[0]];

  useLayoutEffect(() => {
    if (!!externalReference) {
      reference(externalReference);
    }
  }, [reference, externalReference]);

  const cloneProps: Partial<any> & Attributes = { ref: reference };

  if (openAction === 'click') {
    cloneProps.onClick = () => setIsOpen(!isOpen);
  } else if (openAction === 'hover') {
    cloneProps.onMouseEnter = () => setIsOpen(true);
    cloneProps.onMouseLeave = () => setIsOpen(false);
  }

  return (
    <>
      {!externalReference && !!children
        ? cloneElement(children, cloneProps)
        : children}

      {isOpen ? (
        <div
          role="tooltip"
          ref={floating}
          style={{
            position: strategy,
            top: y ?? 0,
            left: x ?? 0,
            width: 'max-content',
          }}
          className="absolute z-0 min-w-[250px] rounded-md border border-slate-500"
        >
          <div
            style={{
              left: arrowX != null ? `${arrowX}px` : '',
              top: arrowY != null ? `${arrowY}px` : '',
              right: '',
              bottom: '',
              [staticSide]: '-4px',
            }}
            className="absolute -z-10 h-4 w-4 rotate-45 bg-slate-500"
            ref={arrowRef}
          ></div>
          <div className="rounded-md bg-white p-3 dark:bg-slate-900 dark:text-slate-400">
            {content}
          </div>
        </div>
      ) : null}
    </>
  );
}
