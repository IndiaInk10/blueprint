import { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchEntry } from '@guide/sdk';
import { useMessages } from '../i18n';

const MAX_RESULTS = 60;
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

/** "퀘이사 캐넌" -> "ㅋㅇㅅ ㅋㄴ", so Korean players can search by initial consonants. */
export function initials(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    out += code >= HANGUL_START && code <= HANGUL_END ? INITIALS[Math.floor((code - HANGUL_START) / 588)] : char;
  }
  return out;
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '');

/** Higher is better; 0 means no match. Title matches beat subtitle and keyword matches. */
export function score(entry: SearchEntry, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(entry.title);
  if (title.startsWith(q)) return 4;
  if (title.includes(q)) return 3;
  if (normalize(initials(entry.title)).includes(q)) return 2;
  const extra = [entry.subtitle ?? '', ...(entry.keywords ?? [])].map(normalize);
  return extra.some((text) => text.includes(q)) ? 1 : 0;
}

/** Ctrl+K search across everything a game module offers; Enter jumps to the entry. */
export function SearchPalette({ entries, onPick, onClose }: { entries: SearchEntry[]; onPick: (entry: SearchEntry) => void; onClose: () => void }) {
  const t = useMessages();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return entries
      .map((entry) => ({ entry, score: score(entry, query) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
      .slice(0, MAX_RESULTS)
      .map((hit) => hit.entry);
  }, [entries, query]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  // Group by label, keeping the ranked order inside each group.
  const groups: { group: string; items: SearchEntry[] }[] = [];
  for (const entry of results) {
    const existing = groups.find((g) => g.group === entry.group);
    if (existing) existing.items.push(entry);
    else groups.push({ group: entry.group, items: [entry] });
  }
  const ordered = groups.flatMap((g) => g.items);

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label={t.search.title} onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={input}
          className="palette-input"
          value={query}
          placeholder={t.search.placeholder}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
            else if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIndex((i) => Math.min(ordered.length - 1, i + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (event.key === 'Enter' && ordered[index]) onPick(ordered[index]);
          }}
        />
        <div ref={list} className="palette-results">
          {!query.trim() && <p className="palette-hint">{t.search.hint}</p>}
          {query.trim() && ordered.length === 0 && <p className="palette-hint">{t.search.noResults}</p>}
          {groups.map((group) => (
            <div key={group.group}>
              <div className="palette-group">{group.group}</div>
              {group.items.map((entry) => {
                const active = ordered[index] === entry;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    data-active={active}
                    className={active ? 'palette-item active' : 'palette-item'}
                    onMouseEnter={() => setIndex(ordered.indexOf(entry))}
                    onClick={() => onPick(entry)}
                  >
                    {entry.icon ? <img className="palette-icon" src={entry.icon} alt="" /> : <span className="palette-icon" />}
                    <span className="palette-title">{entry.title}</span>
                    {entry.subtitle && <span className="palette-subtitle">{entry.subtitle}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-footer">{t.search.footer}</div>
      </div>
    </div>
  );
}
