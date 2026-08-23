const DIALOG_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const ModalFrame = ({
  isOpen,
  onRequestClose,
  titleId,
  overlayClassName,
  dialogClassName,
  closeOnBackdrop = true,
  initialFocusSelector = '[data-dialog-initial-focus="true"]',
  children
}) => {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const closeHandlerRef = useRef(onRequestClose);

  useEffect(() => {
    closeHandlerRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusable = () => [...(dialogRef.current?.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR) || [])]
      .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
    const focusInitialControl = () => {
      const preferredControl = dialogRef.current?.querySelector(initialFocusSelector);
      const target = preferredControl || getFocusable()[0] || dialogRef.current;
      target?.focus({ preventScroll: true });
    };
    const animationFrame = requestAnimationFrame(focusInitialControl);

    const handleDocumentKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHandlerRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleDocumentKeyDown);
      const returnTarget = returnFocusRef.current;
      requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
      });
    };
  }, [isOpen, initialFocusSelector]);

  if (!isOpen) return null;

  return (
    <div
      className={overlayClassName}
      onMouseDown={event => {
        if (closeOnBackdrop && event.target === event.currentTarget) onRequestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};

const ConfirmDeleteDialog = ({ item, isDeleting, onCancel, onConfirm }) => (
  <ModalFrame
    isOpen={Boolean(item)}
    onRequestClose={() => { if (!isDeleting) onCancel(); }}
    titleId="delete-history-title"
    overlayClassName="modal-overlay modal-overlay-confirm animate-fade-in"
    dialogClassName="confirm-dialog animate-fade-in-down"
    closeOnBackdrop={false}
  >
    <div className="confirm-dialog-icon" aria-hidden="true"><Icon name="Trash2" className="h-5 w-5" /></div>
    <div className="confirm-dialog-copy">
      <h2 id="delete-history-title">删除这条记录？</h2>
      <p>「{item?.title || '未命名'}」的文章结果和已生成图片会从本机永久删除，删除后无法恢复。</p>
    </div>
    <div className="confirm-dialog-actions">
      <button
        type="button"
        onClick={onCancel}
        disabled={isDeleting}
        data-dialog-initial-focus="true"
        className="mi-button mi-button-standard confirm-cancel-button"
      >
        取消
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isDeleting}
        aria-busy={isDeleting}
        className="mi-button mi-button-standard confirm-delete-button"
      >
        <Icon name={isDeleting ? 'LoaderCircle' : 'Trash2'} className={`h-4 w-4 ${isDeleting ? 'animate-spin' : ''}`} />
        {isDeleting ? '正在删除' : '确认删除'}
      </button>
    </div>
  </ModalFrame>
);
