    const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
      useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
      }, [onClose, duration]);

      return (
        <div
          className={`mi-toast mi-feedback mi-feedback-${type === 'error' ? 'error' : 'success'} animate-fade-in-down`}
          role={type === 'error' ? 'alert' : 'status'}
          aria-live={type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <div className="mi-toast-icon">
            <Icon name={type === 'error' ? 'AlertCircle' : 'CheckCircle2'} className="h-4 w-4" />
          </div>
          <span className="mi-toast-message">{message}</span>
          <button type="button" onClick={onClose} className="mi-icon-button mi-icon-button-compact mi-toast-dismiss" aria-label="关闭通知" title="关闭通知">
            <Icon name="X" className="h-4 w-4" />
          </button>
        </div>
      );
    };

    const ConfigStatus = ({ state }) => {
      if (!state || state.status === 'idle') return null;
      const iconName = state.status === 'loading' ? 'LoaderCircle' : state.status === 'success' ? 'CheckCircle2' : 'AlertCircle';
      const feedbackType = state.status === 'loading' ? 'neutral' : state.status;
      return (
        <div className={`mi-feedback mi-feedback-${feedbackType} config-status config-status-${state.status}`} role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite">
          <Icon name={iconName} className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
          <span>{state.message}</span>
        </div>
      );
    };

    const ResultsPanel = React.memo(({ content }) => content);
