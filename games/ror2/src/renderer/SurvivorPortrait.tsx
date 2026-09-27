import { useState } from 'react';

interface SurvivorPortraitProps {
  src: string | undefined;
  /** Shown while the image is missing or fails to load, e.g. the name's first letter. */
  fallback: string;
  small?: boolean;
  large?: boolean;
}

export function SurvivorPortrait({ src, fallback, small, large }: SurvivorPortraitProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const className = ['ror2-portrait', small && 'small', large && 'large'].filter(Boolean).join(' ');
  if (!src || failed === src) {
    return (
      <span className={`${className} fallback`} aria-hidden>
        {fallback}
      </span>
    );
  }
  return <img className={className} src={src} alt="" draggable={false} onError={() => setFailed(src)} />;
}
