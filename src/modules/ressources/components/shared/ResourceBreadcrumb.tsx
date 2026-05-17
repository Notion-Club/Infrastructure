'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        onClick={() => router.push('/ressources')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 13,
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          width: 'fit-content',
          transition: 'color 150ms ease',
        }}
        className="hover:text-[var(--color-text-secondary)]"
      >
        <ChevronLeft size={14} />
        Retour aux ressources
      </button>

      <nav
        aria-label="Fil d'Ariane"
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
                    maxWidth: 200,
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
    </div>
  );
}
