'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowReturn } from '@/shared/components/icons';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ResourceBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function ResourceBreadcrumb({ items }: ResourceBreadcrumbProps) {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        data-fb-label="Bouton Revenir à Ressources · Fil d'ariane"
        onClick={() => router.push('/ressources')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px 6px 10px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          width: 'fit-content',
          transition: 'all 150ms ease',
        }}
        className="hover:bg-[#eaeaea] hover:text-[var(--color-text-primary)]"
      >
        <ArrowReturn size={13} />
        Revenir à Ressources
      </button>

      {items.length > 0 && (
        <nav
          aria-label="Fil d'Ariane"
          data-fb-label="Fil d'ariane chemin · Page ressource"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <span
                key={idx}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {idx > 0 && (
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-muted)',
                      lineHeight: 1,
                    }}
                  >
                    ›
                  </span>
                )}
                {!isLast && item.href ? (
                  <Link
                    href={item.href}
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text-muted)',
                      textDecoration: 'none',
                      transition: 'color 150ms ease',
                    }}
                    className="hover:text-[var(--color-text-secondary)]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    style={{
                      fontSize: 13,
                      color: isLast
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-muted)',
                      fontWeight: isLast ? 500 : 400,
                      maxWidth: 240,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      )}
    </div>
  );
}
