import { useEffect } from 'react';
import { Coffee, LoaderCircle, Search, X } from 'lucide-react';
import { mediaUrl } from '../utils/format';

export function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, children, className = '', ...props }) {
  return (
    <button
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <LoaderCircle size={17} className="spin" /> : Icon ? <Icon size={17} strokeWidth={2.2} /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <label className={`field ${className}`.trim()}>
      {label && (
        <span className="field__label">
          {label}
          {required && <span className="field__required"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`input ${className}`.trim()} {...props} />;
}

export function Textarea({ className = '', rows = 4, ...props }) {
  return <textarea className={`input textarea ${className}`.trim()} rows={rows} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`input select ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Cari...', className = '' }) {
  return (
    <div className={`search-input ${className}`.trim()}>
      <Search size={17} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Hapus pencarian">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`badge badge--${tone} ${className}`.trim()}>{children}</span>;
}

export function Spinner({ label = 'Memuat...' }) {
  return (
    <div className="spinner" role="status">
      <LoaderCircle size={24} className="spin" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Coffee, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon"><Icon size={26} /></div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <X size={19} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title = 'Konfirmasi', message, confirmLabel = 'Ya, lanjutkan', onConfirm, onClose, loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function ImageThumb({ src, alt = '', className = '' }) {
  const url = mediaUrl(src);
  return (
    <div className={`image-thumb ${className}`.trim()}>
      {url ? <img src={url} alt={alt} loading="lazy" /> : <Coffee size={22} />}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'primary' }) {
  return (
    <Card className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="stat-card__content">
        <span>{label}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </Card>
  );
}
