import { useT } from './i18n';
import { useRor2 } from './useRor2';
import './ror2.css';

/** Where the guide's data comes from. Lives under Settings → About, not in the builds. */
export function CreditsView() {
  const { content, survivorName } = useRor2();
  const t = useT();
  if (!content) return null;

  return (
    <div className="ror2-credits">
      <ul className="ror2-credits-facts">
        <li>{t.credits.gameFiles}</li>
        <li>
          {t.credits.images}{' '}
          <a href="https://riskofrain2.wiki.gg" target="_blank" rel="noreferrer">
            riskofrain2.wiki.gg
          </a>
        </li>
        <li>{t.credits.builds(content.manifest.gameVersion, content.manifest.updatedAt)}</li>
      </ul>
      {content.survivors.map((survivor) => {
        const file = content.builds[survivor.id];
        if (!file || file.sources.length === 0) return null;
        return (
          <details key={survivor.id} className="ror2-credits-survivor">
            <summary>
              {survivorName(survivor.id)} <span className="ror2-muted">{file.sources.length}</span>
            </summary>
            <ul>
              {file.sources.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url.replace(/^https?:\/\//, '')}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
