import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import {
  DICTIONARY_LANGUAGES,
  LANGUAGE_CONTROLLED_GAMES,
  getDictionaryLanguageMeta,
  useDictionaryLanguage,
  type DictionaryLanguageCode,
} from '@/lib/dictionary-languages';

interface LanguageMenuProps {
  /** 'header' matches SiteHeader buttons; 'compact' fits inside standalone game toolbars */
  variant?: 'header' | 'compact';
  /** Optional alignment of the dropdown popover */
  align?: 'left' | 'right';
  /** Optional extra classes on wrapper */
  className?: string;
}

export const LanguageMenu: React.FC<LanguageMenuProps> = ({
  variant = 'compact',
  align = 'right',
  className = '',
}) => {
  const [language, setLanguage] = useDictionaryLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeMeta = getDictionaryLanguageMeta(language);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSelect = (code: DictionaryLanguageCode) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Word dictionary language: ${activeMeta.label}`}
          title="Game Word Dictionary Language"
          className="header-action"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
          }}
        >
          <Globe size={15} aria-hidden="true" />
          <span style={{ fontWeight: 800, letterSpacing: '0.04em' }}>
            {activeMeta.flag} {activeMeta.shortCode}
          </span>
          <ChevronDown
            size={13}
            aria-hidden="true"
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 160ms ease',
            }}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Word dictionary language: ${activeMeta.label}`}
          title="Change word dictionary language"
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-[#23063A]/90 px-2.5 py-1.5 text-xs font-extrabold text-amber-200 shadow-sm transition-all hover:border-amber-300 hover:bg-[#310a52] hover:text-white cursor-pointer whitespace-nowrap"
        >
          <Globe className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>
            {activeMeta.flag} {activeMeta.shortCode}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-amber-300/80 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}

      {open && (
        <div
          role="listbox"
          aria-label="Select word dictionary language"
          className={`absolute top-full mt-2 w-64 rounded-2xl border border-amber-400/40 bg-[#1A042D] text-white shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl z-[120] overflow-hidden ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <div className="px-3.5 py-2.5 border-b border-purple-500/30 bg-[#250740]">
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300">
              <Globe className="w-3.5 h-3.5" />
              <span>Word Dictionary Language</span>
            </div>
            <p className="text-[11px] text-purple-200/85 mt-0.5 leading-snug">
              One menu controls dictionaries across all supported word games.
            </p>
          </div>

          <div className="p-1.5 space-y-0.5">
            {DICTIONARY_LANGUAGES.map((item) => {
              const isSelected = item.code === language;
              return (
                <button
                  key={item.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item.code)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400/20 text-amber-200 border border-amber-400/50'
                      : 'text-purple-100 hover:bg-purple-800/45 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base leading-none">{item.flag}</span>
                    <span className="flex flex-col leading-tight">
                      <span className="font-extrabold text-white">{item.nativeLabel}</span>
                      {item.nativeLabel !== item.label && (
                        <span className="text-[10px] font-semibold text-purple-300">
                          {item.label}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono font-extrabold text-purple-300">
                      {item.shortCode}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-300" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="px-3.5 py-2 border-t border-purple-500/25 bg-[#120221]/90">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 mb-1">
              Applies to:
            </div>
            <div className="flex flex-wrap gap-1">
              {LANGUAGE_CONTROLLED_GAMES.map((gameName) => (
                <span
                  key={gameName}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-900/70 text-purple-100 border border-purple-500/30"
                >
                  {gameName}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
