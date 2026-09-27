// Shared browsing components for game modules: a list on the left, the chosen entry on the right.
// Styling uses the host's --gg-* tokens, so every game looks the same and follows the theme.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useGameUi } from './react';
import './ui.css';

/** State that survives switching tabs and restarting the app. Per viewer, never shared. */
export function usePersistentState<T>(key: string, initial: T): [T, (next: T) => void] {
  const storageKey = `blueprint:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage can be unavailable; the value still works for this session.
      }
    },
    [storageKey],
  );
  return [value, update];
}

/**
 * The selected entry of a view: remembered between visits, and moved to whatever the global
 * search or another view's link points at.
 */
export function useSelection(viewId: string, fallback: string | null = null): [string | null, (id: string | null) => void] {
  const ui = useGameUi();
  const [selected, setSelected] = usePersistentState<string | null>(`${viewId}:selected`, fallback);
  const target = ui.target;
  useEffect(() => {
    if (target?.viewId === viewId && target.entryId) setSelected(target.entryId);
    // Only a new request (seq) moves the selection.
  }, [target?.seq]);
  return [selected, setSelected];
}

/** List on the left that stays in view while the detail on the right scrolls with the page. */
export function MasterDetail({ list, detail, listWidth = 320 }: { list: ReactNode; detail: ReactNode; listWidth?: number }) {
  return (
    <div className="ui-master-detail" style={{ gridTemplateColumns: `${listWidth}px minmax(0, 1fr)` }}>
      <aside className="ui-master">{list}</aside>
      <div className="ui-detail">{detail}</div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (next: string) => void; placeholder: string }) {
  return (
    <input
      className="ui-search"
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onChange('');
      }}
    />
  );
}

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

/** Single-choice filter chips. */
export function Chips<T extends string>({ options, value, onChange }: { options: ChipOption<T>[]; value: T; onChange: (next: T) => void }) {
  return (
    <div className="ui-chips" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={value === option.id ? 'ui-chip active' : 'ui-chip'}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.count !== undefined && <span className="ui-chip-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export interface ListGroup<T> {
  key: string;
  title?: string;
  items: T[];
}

/**
 * A keyboard-friendly list: ↑/↓ move the selection, the selected row scrolls into view.
 * Rows are grouped under small headings when groups have titles.
 */
export function SelectList<T>({
  groups,
  getKey,
  selected,
  onSelect,
  renderItem,
  empty,
}: {
  groups: ListGroup<T>[];
  getKey: (item: T) => string;
  selected: string | null;
  onSelect: (key: string) => void;
  renderItem: (item: T, active: boolean) => ReactNode;
  empty?: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const keys = groups.flatMap((group) => group.items.map(getKey));

  useEffect(() => {
    const row = container.current?.querySelector<HTMLElement>('[data-active="true"]');
    row?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const index = selected ? keys.indexOf(selected) : -1;
    const next = event.key === 'ArrowDown' ? Math.min(keys.length - 1, index + 1) : Math.max(0, index - 1);
    const key = keys[next];
    if (key) onSelect(key);
  };

  if (keys.length === 0) return <div className="ui-list-empty">{empty}</div>;
  return (
    <div ref={container} className="ui-list" role="listbox" tabIndex={0} onKeyDown={onKeyDown}>
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.key} className="ui-list-group">
            {group.title && (
              <div className="ui-list-heading">
                {group.title} <span className="ui-list-count">{group.items.length}</span>
              </div>
            )}
            {group.items.map((item) => {
              const key = getKey(item);
              const active = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-active={active}
                  tabIndex={-1}
                  className={active ? 'ui-list-row active' : 'ui-list-row'}
                  onClick={() => onSelect(key)}
                >
                  {renderItem(item, active)}
                </button>
              );
            })}
          </div>
        ))}
    </div>
  );
}

/** The usual row content: icon, title with an optional trailing badge, one muted line under it. */
export function Row({ icon, title, subtitle, trailing }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode }) {
  return (
    <>
      {icon && <span className="ui-row-icon">{icon}</span>}
      <span className="ui-row-text">
        <span className="ui-row-title">{title}</span>
        {subtitle && <span className="ui-row-subtitle">{subtitle}</span>}
      </span>
      {trailing && <span className="ui-row-trailing">{trailing}</span>}
    </>
  );
}
