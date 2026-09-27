import { useCallback, useEffect, useState } from 'react';
import { Hd2Action } from '../selection';
import { useT } from './i18n';
import { useHd2 } from './useHd2';
import './hd2.css';

/** What the main process reports about the game's settings file (see main/graphics.ts). */
interface GraphicsStatus {
  found: boolean;
  values: Record<string, number | null>;
  applied: boolean;
  hasBackup: boolean;
}

type Result = 'done' | 'game-running' | 'not-found' | 'no-backup';

const TARGETS = { light_falloff_end_target: 3, lighting_and_material_quality: 2 } as const;

/** Settings → Games: applies the DX11 lighting fix to the game's settings file, or restores it. */
export function GraphicsSettings() {
  const { ui } = useHd2();
  const t = useT();
  const [status, setStatus] = useState<GraphicsStatus | null>(null);
  const [message, setMessage] = useState<{ text: string; warn: boolean } | null>(null);

  const refresh = useCallback(async () => setStatus((await ui.invoke(Hd2Action.GraphicsStatus)) as GraphicsStatus), [ui]);
  useEffect(() => void refresh(), [refresh]);

  const run = async (action: string, done: string) => {
    const result = (await ui.invoke(action)) as Result;
    setMessage(result === 'done' ? { text: done, warn: false } : { text: t.graphics.results[result], warn: true });
    await refresh();
  };

  const rows = [
    { key: 'light_falloff_end_target' as const, label: t.graphics.falloff },
    { key: 'lighting_and_material_quality' as const, label: t.graphics.lighting },
  ];

  return (
    <div className="hd2-graphics">
      <div className="hd2-graphics-head">
        <strong>{t.graphics.title}</strong>
        {status?.found && (
          <span className={status.applied ? 'hd2-graphics-state ok' : 'hd2-graphics-state'}>
            {status.applied ? t.graphics.applied : t.graphics.notApplied}
          </span>
        )}
      </div>
      <p className="hd2-graphics-text">{t.graphics.description}</p>
      {status && !status.found && <p className="hd2-graphics-text warn">{t.graphics.results['not-found']}</p>}
      {status?.found && (
        <ul className="hd2-graphics-values">
          {rows.map((row) => (
            <li key={row.key}>
              <span>{row.label}</span>
              <span className={status.values[row.key] === TARGETS[row.key] ? 'ok' : ''}>
                {status.values[row.key] ?? '—'} → {TARGETS[row.key]}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="hd2-graphics-text muted">{t.graphics.notes}</p>
      <div className="hd2-graphics-actions">
        <button type="button" className="hd2-follow" disabled={!status?.found} onClick={() => void run(Hd2Action.GraphicsApply, t.graphics.doneApply)}>
          {t.graphics.apply}
        </button>
        <button
          type="button"
          className="hd2-follow following"
          disabled={!status?.hasBackup}
          onClick={() => void run(Hd2Action.GraphicsRestore, t.graphics.doneRestore)}
        >
          {t.graphics.restore}
        </button>
      </div>
      {message && <p className={message.warn ? 'hd2-graphics-text warn' : 'hd2-graphics-text ok'}>{message.text}</p>}
    </div>
  );
}
