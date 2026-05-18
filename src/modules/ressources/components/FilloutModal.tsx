'use client';

import { useEffect } from 'react';

export type FilloutType = 'Template Notion' | 'Ressource';

interface FilloutModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: FilloutType;
}

const FILLOUT_SCRIPT = 'https://server.fillout.com/embed/v1/';

export function FilloutModal({ isOpen, onClose, type }: FilloutModalProps) {
  // Inject / re-inject Fillout script each time the modal opens so it
  // picks up the freshly-mounted embed div.
  useEffect(() => {
    if (!isOpen) return;
    const existing = document.querySelector(`script[src="${FILLOUT_SCRIPT}"]`);
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.src = FILLOUT_SCRIPT;
    script.async = true;
    document.head.appendChild(script);
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  // TODO(backend): replace with real values from the authenticated session.
  const userEmail = '';
  const memberId = '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 780,
          background: '#ffffff',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow:
            '0 0 0 0.5px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.18), 0 32px 80px rgba(0,0,0,0.22)',
        }}
      >
        {/* macOS title bar */}
        <div
          style={{
            height: 44,
            background: '#ececec',
            borderBottom: '1px solid rgba(0,0,0,0.09)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer"
            className="group/dot"
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ff5f57',
              border: '0.5px solid rgba(0,0,0,0.15)',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              color: 'rgba(0,0,0,0)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(80,0,0,0.6)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0)'; }}
          >
            ✕
          </button>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ffbd2e',
              border: '0.5px solid rgba(0,0,0,0.1)',
              display: 'block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#28c840',
              border: '0.5px solid rgba(0,0,0,0.1)',
              display: 'block',
              flexShrink: 0,
            }}
          />
        </div>

        {/* Fillout embed */}
        <div
          data-fillout-id="dvXPyK3G39us"
          data-fillout-embed-type="standard"
          data-fillout-inherit-parameters=""
          data-fillout-dynamic-resize=""
          data-email={userEmail}
          data-member_id={memberId}
          data-type={type}
          style={{ width: '100%', height: 500 }}
        />
      </div>
    </div>
  );
}
