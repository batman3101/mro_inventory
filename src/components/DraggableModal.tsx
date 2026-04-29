import { useRef, useState, useEffect, MouseEvent as RMouseEvent, ReactNode } from 'react';
import { Modal } from 'antd';
import type { ModalProps } from 'antd';

// Drop-in replacement for antd `<Modal>` that adds a draggable title bar.
// The title becomes the drag handle; the modal stays centered initially and
// the drag offset is applied via CSS transform on the modal wrapper. Position
// resets each time the modal is reopened so users always start from center.
export const DraggableModal = ({
  title,
  modalRender,
  ...rest
}: ModalProps) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0 });

  useEffect(() => {
    if (!rest.open) setPos({ x: 0, y: 0 });
  }, [rest.open]);

  const handleMouseDown = (e: RMouseEvent<HTMLDivElement>) => {
    // Don't intercept clicks on close-button etc that bubble through the title slot.
    const target = e.target as HTMLElement;
    if (target.closest('.ant-modal-close')) return;
    e.preventDefault();
    draggingRef.current = true;
    startRef.current = { mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y };

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!draggingRef.current) return;
      setPos({
        x: startRef.current.x + (ev.clientX - startRef.current.mx),
        y: startRef.current.y + (ev.clientY - startRef.current.my),
      });
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const dragHandle = (
    <div
      onMouseDown={handleMouseDown}
      style={{ width: '100%', cursor: 'move', userSelect: 'none' }}
    >
      {title}
    </div>
  );

  const wrappedRender = (modal: ReactNode) => {
    const inner = modalRender ? modalRender(modal) : modal;
    return (
      <div style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
        {inner}
      </div>
    );
  };

  return <Modal {...rest} title={dragHandle} modalRender={wrappedRender} />;
};
