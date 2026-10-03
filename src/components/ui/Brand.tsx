/**
 * Brand marks — all derived from the official SAND identity file.
 *  <Logo>      full-colour logo (raster extracted from the identity's app icon; never distorted)
 *  <LogoMark>  single-colour silhouette for small sizes and dark backgrounds
 *  <Wordmark>  logo + name lockup for the header
 *  <Star>      the identity's four-pointed star
 *  <Arch>      the mihrab arch frame from the logo's dome
 */
import type { CSSProperties, ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { cx } from '../../lib/cx';

/** Intrinsic aspect ratio of the extracted logo (280 × 298 px). */
const LOGO_RATIO = 280 / 298;

export function Logo({ height, className, decorative = false }: { height: number; className?: string; decorative?: boolean }) {
  const { t } = useI18n();
  return (
    <picture className={cx('inline-block shrink-0', className)} style={{ height, width: Math.round(height * LOGO_RATIO) }}>
      <source srcSet={height <= 56 ? '/brand/sanad-logo-small.webp' : '/brand/sanad-logo@2x.webp'} type="image/webp" />
      <img
        src={height <= 56 ? '/brand/sanad-logo.png' : '/brand/sanad-logo@2x.png'}
        alt={decorative ? '' : `${t.brand.name} — ${t.brand.slogan}`}
        width={Math.round(height * LOGO_RATIO)}
        height={height}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </picture>
  );
}

export function LogoMark({ size = 24, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  // Mask keeps the exact traced silhouette while letting CSS choose the colour (currentColor).
  return (
    <span
      aria-hidden
      className={cx('inline-block shrink-0 bg-current', className)}
      style={{
        width: Math.round(size * LOGO_RATIO),
        height: size,
        WebkitMask: 'url(/brand/sanad-mark.svg) center / contain no-repeat',
        mask: 'url(/brand/sanad-mark.svg) center / contain no-repeat',
        ...style,
      }}
    />
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-3">
      <Logo height={compact ? 34 : 40} decorative />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.45rem] leading-none text-forest">{t.brand.name}</span>
        {!compact && (
          <span lang="ar" dir="rtl" className="mt-1 hidden text-[0.72rem] leading-none text-carob-ink sm:block">
            {t.brand.sloganAr}
          </span>
        )}
      </span>
    </span>
  );
}

export function Star({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z" fill="currentColor" />
    </svg>
  );
}

/**
 * The mihrab arch — the single bold shape of the interface.
 * Fixed viewBox keeps its proportions at every width (no distortion).
 */
export function Arch({ children, className, animate = false }: { children?: ReactNode; className?: string; animate?: boolean }) {
  return (
    <div className={cx('relative aspect-[4/5]', className)}>
      <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <pattern id="sanad-star-lattice" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M18 6C18.5 14 22 17.5 30 18C22 18.5 18.5 22 18 30C17.5 22 14 18.5 6 18C14 17.5 17.5 14 18 6Z" fill="#D4B08A" opacity="0.16" />
          </pattern>
          <clipPath id="sanad-arch-clip">
            <path d="M0 500V232C0 128 108 74 200 6C292 74 400 128 400 232V500Z" />
          </clipPath>
        </defs>
        <path d="M0 500V232C0 128 108 74 200 6C292 74 400 128 400 232V500Z" fill="#EDE6D9" />
        <rect width="400" height="500" fill="url(#sanad-star-lattice)" clipPath="url(#sanad-arch-clip)" />
        <path
          d="M14 500V236C14 140 116 90 200 26C284 90 386 140 386 236V500"
          fill="none"
          stroke="#6B7F61"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          pathLength={1}
          className={animate ? 'arch-draw' : undefined}
        />
      </svg>
      <div className="relative flex h-full w-full flex-col items-center justify-center">{children}</div>
    </div>
  );
}
