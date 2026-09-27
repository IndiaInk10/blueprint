import { useState, type ReactNode } from 'react';
import { steamArtUrl, type LibraryArtKind } from '../../../shared/steamArt';

interface SteamArtProps {
  appId: number | undefined;
  kind: LibraryArtKind;
  className?: string;
  alt?: string;
  /** Rendered when the game has no Steam id or Steam has not cached this image. */
  fallback?: ReactNode;
}

export function SteamArt({ appId, kind, className, alt = '', fallback = null }: SteamArtProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = appId ? steamArtUrl(appId, kind) : null;
  if (!url || failedUrl === url) return <>{fallback}</>;
  return <img className={className} src={url} alt={alt} draggable={false} onError={() => setFailedUrl(url)} />;
}
