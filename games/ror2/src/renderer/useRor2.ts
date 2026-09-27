import { useCallback, useEffect, useState } from 'react';
import { useGameUi } from '@guide/sdk/react';
import type { LocalizedText, Ror2Content } from '../content/schema';
import { Ror2Action, selectionSchema, type Selection } from '../selection';

/** Content plus name helpers. Names come from the game install when available. */
export function useRor2() {
  const ui = useGameUi<Ror2Content>();
  const content = ui.content;

  const tr = useCallback((text: LocalizedText | undefined) => (text ? (text[ui.locale] ?? text.en) : ''), [ui.locale]);
  const itemName = useCallback(
    (id: string) => {
      const item = content?.items[id];
      return item ? ui.text(item.token, item.en) : id;
    },
    [content, ui],
  );
  const survivorName = useCallback(
    (id: string) => {
      const survivor = content?.survivors.find((s) => s.id === id);
      return survivor ? ui.text(survivor.token, survivor.en) : id;
    },
    [content, ui],
  );

  const itemIcon = useCallback(
    (id: string) => (content?.items[id]?.icon ? ui.assetUrl('item', id) : undefined),
    [content, ui],
  );
  const survivorIcon = useCallback(
    (id: string) => (content?.survivors.some((s) => s.id === id && s.icon) ? ui.assetUrl('survivor', id) : undefined),
    [content, ui],
  );

  return { ui, content, tr, itemName, survivorName, itemIcon, survivorIcon };
}

/** The build the overlay follows, persisted by the main process. */
export function useSelection() {
  const { ui } = useRor2();
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    void ui.invoke(Ror2Action.GetSelection).then((value) => {
      const parsed = selectionSchema.safeParse(value);
      if (parsed.success) setSelection(parsed.data);
    });
  }, [ui]);

  const select = useCallback(
    async (next: Selection) => {
      const saved = selectionSchema.parse(await ui.invoke(Ror2Action.Select, next));
      setSelection(saved);
    },
    [ui],
  );

  return { selection, select };
}
