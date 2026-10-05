import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p });

export const Globe = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></svg>);
export const Mic = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
export const MicOff = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2.2M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.6 2.8M12 18v3" /></svg>);
export const Arrow = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} className={'flip ' + (p.className ?? '')}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const Back = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} className={'flip ' + (p.className ?? '')}><path d="M15 6l-6 6 6 6" /></svg>);
export const Chevron = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>);
export const Next = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} className={'flip ' + (p.className ?? '')}><path d="M9 6l6 6-6 6" /></svg>);
export const Check = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 12l5 5 9-10" /></svg>);
export const External = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>);
export const Speaker = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6" /></svg>);
export const Chat = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 5h16v11H9l-5 4V5z" /></svg>);
export const Info = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>);
export const User = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>);
export const UserPlus = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="10" cy="8" r="4" /><path d="M2 21c1.5-4 4.5-6 8-6 1.5 0 2.8.3 4 1M19 14v6M16 17h6" /></svg>);
export const Pencil = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>);
export const Search = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M9 11h4" /></svg>);
export const WifiOff = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.5M15 10.5a10 10 0 0 1 4 2.5M2 9.5a15 15 0 0 1 4.5-2.7M12 6a15 15 0 0 1 10 3.5M12 20h.01" /></svg>);
export const Close = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);

export function Rings({ width = 46, dark = false }: { width?: number; dark?: boolean }) {
  return (
    <svg width={width} viewBox="0 0 60 26" aria-hidden="true">
      <circle cx="13" cy="13" r="10" fill="none" stroke={dark ? '#6B7F61' : '#A7B28F'} strokeWidth="3.3" />
      <circle cx="30" cy="13" r="10" fill="none" stroke={dark ? '#A7B28F' : '#6B7F61'} strokeWidth="3.3" />
      <circle cx="47" cy="13" r="10" fill={dark ? '#FFFFFF' : '#3E5636'} />
    </svg>
  );
}

export function Brand({ sub, dark, onClick }: { sub?: string; dark?: boolean; onClick?: () => void }) {
  return (
    <a className="brand" href="#/" onClick={onClick} aria-label="Sanad">
      <Rings dark={dark} />
      <span className="word">
        <span className="ar">سَنَد</span>
        <span className="en">{sub ?? 'SANAD'}</span>
      </span>
    </a>
  );
}
