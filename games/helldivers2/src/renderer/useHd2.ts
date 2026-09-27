import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameUi } from '@guide/sdk/react';
import type { Hd2Content, LocalizedText } from '../content/schema';
import { Hd2Action, profileSchema, selectionSchema, type Profile, type Selection } from '../selection';

export type AssetKind = 'weapon' | 'stratagem' | 'armor' | 'booster' | 'warbond' | 'attachment';

/** Content plus text and image helpers. */
export function useHd2() {
  const ui = useGameUi<Hd2Content>();
  const content = ui.content;
  const tr = useCallback((text: LocalizedText | undefined) => (text ? (text[ui.locale] ?? text.en) : ''), [ui.locale]);
  const icon = useCallback(
    (kind: AssetKind, id: string) => {
      if (!content) return undefined;
      const entry =
        kind === 'weapon'
          ? content.weapons[id]
          : kind === 'stratagem'
            ? content.stratagems[id]
            : kind === 'armor'
              ? content.armorPassives[id]
              : kind === 'booster'
                ? content.boosters[id]
                : kind === 'attachment'
                  ? content.customization.attachments[id]
                  : content.warbonds.find((warbond) => warbond.id === id);
      return entry?.icon ? ui.assetUrl(kind, id) : undefined;
    },
    [content, ui],
  );
  return { ui, content, tr, icon };
}

/** The loadout the overlay follows, persisted by the main process. */
export function useSelection() {
  const { ui } = useHd2();
  const [selection, setSelection] = useState<Selection>(null);
  useEffect(() => {
    void ui.invoke(Hd2Action.GetSelection).then((value) => {
      const parsed = selectionSchema.safeParse(value);
      if (parsed.success) setSelection(parsed.data);
    });
  }, [ui]);
  const select = useCallback(
    async (next: Selection) => setSelection(selectionSchema.parse(await ui.invoke(Hd2Action.Select, next))),
    [ui],
  );
  return { selection, select };
}

/** Owned warbonds and play preferences, persisted by the main process. */
export function useProfile() {
  const { ui } = useHd2();
  const [profile, setProfile] = useState<Profile | null>(null);
  // Changes build on the latest profile, not on the one a click handler closed over.
  const latest = useRef<Profile>(profileSchema.parse({}));
  useEffect(() => {
    void ui.invoke(Hd2Action.GetProfile).then((value) => {
      const parsed = profileSchema.safeParse(value);
      latest.current = parsed.success ? parsed.data : profileSchema.parse({});
      setProfile(latest.current);
    });
  }, [ui]);
  const update = useCallback(
    (change: Partial<Profile> | ((current: Profile) => Partial<Profile>)) => {
      const patch = typeof change === 'function' ? change(latest.current) : change;
      latest.current = profileSchema.parse({ ...latest.current, ...patch });
      setProfile(latest.current);
      // Saves go out in order and each carries the whole profile, so the last one wins.
      void ui.invoke(Hd2Action.SetProfile, latest.current);
    },
    [ui],
  );
  return { profile, update };
}
