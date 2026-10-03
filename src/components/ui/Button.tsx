import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'secondary' | 'quiet' | 'warm';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Dark Green with Vanilla text: 8.3:1 contrast (white on Matcha would be 4.3:1)
  primary:
    'bg-forest text-vanilla hover:bg-forest-deep active:bg-forest-deep shadow-[0_1px_0_rgb(255_255_255/0.08)_inset] disabled:bg-pistache disabled:text-vanilla',
  secondary:
    'bg-paper text-forest border border-oat hover:border-matcha hover:bg-vanilla disabled:text-matcha-ink/60',
  quiet: 'text-matcha-ink hover:text-forest hover:bg-almond/70 disabled:text-pistache',
  warm: 'bg-carob-ink text-vanilla hover:bg-carob disabled:bg-sand',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-full',
  md: 'h-11 px-5 text-[0.95rem] gap-2 rounded-full',
  lg: 'h-13 px-7 text-base gap-2.5 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconEnd?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', icon, iconEnd, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'ui-text inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors duration-200 ease-(--ease-calm)',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconEnd}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'quiet' | 'secondary' | 'primary';
  size?: 'sm' | 'md';
}

export function IconButton({ label, variant = 'quiet', size = 'md', className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-200',
        size === 'md' ? 'size-11' : 'size-9',
        variant === 'quiet' && 'text-matcha-ink hover:bg-almond hover:text-forest',
        variant === 'secondary' && 'border border-oat bg-paper text-forest hover:border-matcha',
        variant === 'primary' && 'bg-forest text-vanilla hover:bg-forest-deep disabled:bg-oat disabled:text-matcha-ink/50',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
