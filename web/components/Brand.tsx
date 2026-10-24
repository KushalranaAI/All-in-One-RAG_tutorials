import { BRAND } from "@/lib/brand";

// Small filled brand marks (24px grid), drawn here so no icon package is needed.
const MARKS: Record<string, React.ReactNode> = {
  portfolio: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.900 9h-3.100a15.700 15.700 0 0 0-1.200-5.300A8 8 0 0 1 18.900 11ZM12 4c.800 1 1.700 3.200 1.900 7h-3.800C10.300 7.200 11.200 5 12 4ZM9.400 5.700A15.700 15.700 0 0 0 8.200 11H5.100a8 8 0 0 1 4.300-5.300ZM5.100 13h3.100c.1 1.900.5 3.700 1.200 5.300A8 8 0 0 1 5.100 13Zm6.900 7c-.8-1-1.700-3.200-1.900-7h3.800c-.2 3.800-1.100 6-1.900 7Zm2.600-1.700c.700-1.600 1.100-3.400 1.200-5.300h3.100a8 8 0 0 1-4.300 5.300Z" />,
  linkedin: <path d="M4.5 3A1.9 1.9 0 1 0 4.5 6.8 1.9 1.9 0 0 0 4.5 3ZM3 8.5h3V21H3V8.5Zm5.5 0h2.9v1.7h.1c.4-.8 1.4-1.9 3.1-1.9 3.3 0 3.9 2.200 3.900 5V21h-3v-6.800c0-1.600 0-3.600-2.200-3.600s-2.500 1.700-2.500 3.500V21h-3V8.500Z" />,
  youtube: <path d="M21.600 7.200a2.500 2.500 0 0 0-1.800-1.800C18.200 5 12 5 12 5s-6.200 0-7.800.4A2.500 2.500 0 0 0 2.400 7.200C2 8.800 2 12 2 12s0 3.200.4 4.800a2.500 2.500 0 0 0 1.800 1.800C5.800 19 12 19 12 19s6.200 0 7.800-.4a2.500 2.500 0 0 0 1.800-1.800c.4-1.600.4-4.800.4-4.800s0-3.200-.4-4.800ZM10 15V9l5.200 3-5.200 3Z" />,
  x: <path d="M17.800 3h3.100l-6.800 7.700L22 21h-6.200l-4.800-6.300L5.400 21H2.300l7.300-8.300L2 3h6.400l4.400 5.800L17.800 3Zm-1.100 16.200h1.700L7.400 4.700H5.600l11.100 14.500Z" />,
  medium: <path d="M3.500 6.800C3.500 4.700 5.200 3 7.300 3h9.400c2.100 0 3.800 1.700 3.800 3.800v10.400c0 2.100-1.700 3.800-3.800 3.800H7.300c-2.100 0-3.800-1.700-3.800-3.800V6.800Zm4.400 2.600v5.300c0 .6-.4.900-.9.700V9.900l1.600 2.800 1.600-2.800v4.600c0 .5.300.7.700.700H8.400c.600 0 1-.2 1-.9V9.400h-1.500Zm7.200-.4c-1.200 0-2 1.200-2 2.800s.9 2.800 2 2.800 2-1.200 2-2.800-.9-2.800-2-2.800Zm3.300.1c-.4 0-.7 1.100-.7 2.700s.3 2.700.7 2.700.7-1.100.7-2.700-.3-2.700-.7-2.700Z" />,
};

/** The four profile links as small icon buttons. Opens in a new tab. */
export function SocialLinks({ size = 16 }: { size?: number }) {
  return (
    <span className="social-links">
      {BRAND.links.map((l) => (
        <a key={l.id} href={l.href} target="_blank" rel="noopener noreferrer me" aria-label={`${BRAND.name} on ${l.label}`} title={l.label}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">{MARKS[l.id]}</svg>
        </a>
      ))}
    </span>
  );
}

/** "Built by Kushal Rana" + links, kept small and out of the way. */
export default function BuiltBy({ className = "" }: { className?: string }) {
  return (
    <div className={`built-by ${className}`}>
      <span>Built by <a href={BRAND.links[0].href} target="_blank" rel="noopener noreferrer me"><b>{BRAND.name}</b></a></span>
      <SocialLinks />
    </div>
  );
}
