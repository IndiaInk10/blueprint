import { useT } from './i18n';
import { useHd2 } from './useHd2';
import './hd2.css';

/** Where the guide's data comes from. Lives under Settings → About. */
export function CreditsView() {
  const { content } = useHd2();
  const t = useT();
  if (!content) return null;
  return (
    <div className="hd2-credits">
      <ul className="hd2-credits-facts">
        <li>{t.credits.names}</li>
        <li>
          {t.credits.images}{' '}
          <a href="https://helldivers.wiki.gg" target="_blank" rel="noreferrer">
            helldivers.wiki.gg
          </a>
        </li>
        <li>{t.credits.loadouts(content.manifest.gameVersion, content.manifest.updatedAt)}</li>
      </ul>
      {content.sources.length > 0 && (
        <details>
          <summary>
            {t.credits.guides} <span className="hd2-muted">{content.sources.length}</span>
          </summary>
          <ul>
            {content.sources.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {url.replace(/^https?:\/\//, '')}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
