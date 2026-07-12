'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type FilloutType = 'Template Notion' | 'Ressource';

interface FilloutModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: FilloutType;
}

const FILLOUT_SCRIPT = 'https://server.fillout.com/embed/v1/';
const TRANSITION_MS = 220;

export function FilloutModal({ isOpen, onClose, type }: FilloutModalProps) {
  // mounted = DOM node exists ; visible = CSS transition target state
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Double rAF so the browser paints the initial state before transitioning.
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));

      // Inject / re-inject Fillout script so it picks up the freshly-mounted div.
      const existing = document.querySelector(`script[src="${FILLOUT_SCRIPT}"]`);
      if (existing) existing.remove();
      const script = document.createElement('script');
      script.src = FILLOUT_SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), TRANSITION_MS);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // TODO(backend): replace with real values from the authenticated session.
  const userEmail = '';
  const memberId = '';

  if (!mounted) return null;

  // Portal renders at document.body level, fully above nc-page-halo's
  // isolation: isolate stacking context and the fixed Topbar / BottomNav.
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: visible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(6px)' : 'blur(0px)',
        WebkitBackdropFilter: visible ? 'blur(6px)' : 'blur(0px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        transition: `background ${TRANSITION_MS}ms var(--nc-ease), backdrop-filter ${TRANSITION_MS}ms var(--nc-ease)`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 660,
          background: 'var(--color-surface-card)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow:
            '0 0 0 0.5px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.18), 0 32px 80px rgba(0,0,0,0.22)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)',
          transition: `opacity ${TRANSITION_MS}ms var(--nc-ease), transform ${TRANSITION_MS}ms var(--nc-ease)`,
        }}
      >
        {/* macOS title bar */}
        <div
          style={{
            height: 40,
            background: '#ececec',
            borderBottom: '1px solid rgba(0,0,0,0.09)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer"
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
              transition: 'color 100ms var(--nc-ease)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(80,0,0,0.55)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0)'; }}
          >
            ✕
          </button>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e', border: '0.5px solid rgba(0,0,0,0.1)', display: 'block', flexShrink: 0 }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', border: '0.5px solid rgba(0,0,0,0.1)', display: 'block', flexShrink: 0 }} />
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
    </div>,
    document.body
  );
}
