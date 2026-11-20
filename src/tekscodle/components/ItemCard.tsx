import React, { useEffect, useState } from 'react';
import { SupermarketItem } from '../data/items';
import { formatGBP } from '../utils/gameLogic';
import { ProductPackVisual } from './ProductPackVisual';

interface ItemCardProps {
  item: SupermarketItem;
  index: number;
  totalInBasket: number;
  revealed: boolean;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  index,
  totalInBasket,
  revealed,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [item.id, item.image]);

  const hasPhoto = Boolean(item.image) && !imgFailed;
  const isStudioPackshot = hasPhoto && item.image.startsWith('/tekscodle/images/catalog/');
  const isSingleFeatured = totalInBasket === 1;

  if (isSingleFeatured) {
    return (
      <article className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200/80 dark:border-purple-800/70 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch shadow-md">
        <div
          className={`md:col-span-7 relative min-h-[260px] md:min-h-[340px] flex items-center justify-center ${
            isStudioPackshot
              ? 'bg-white border-b md:border-b-0 md:border-r border-purple-100 dark:border-purple-900/40 p-6'
              : 'bg-[#EEF2F6] dark:bg-[#190529]'
          }`}
        >
          {hasPhoto ? (
            <img
              src={item.image}
              alt={`${item.name} (${item.packSize})`}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className={
                isStudioPackshot
                  ? 'max-h-[300px] w-full object-contain'
                  : 'w-full h-full object-cover'
              }
            />
          ) : (
            <ProductPackVisual item={item} />
          )}

          {revealed && (
            <div className="absolute bottom-4 right-4 bg-[#F6C915] text-[#1D0830] px-4 py-2 rounded-xl shadow-md border border-amber-300">
              <div className="text-[11px] font-bold tracking-wide text-[#1D0830]/80">
                Shelf Price
              </div>
              <div className="font-mono text-2xl font-extrabold tabular-nums leading-tight">
                {formatGBP(item.pricePence)}
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-5 p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center flex-wrap gap-2 text-xs font-medium text-slate-500 dark:text-purple-200/75 mb-2">
              <span>{item.aisle}</span>
              <span aria-hidden="true">·</span>
              <span>{item.packSize}</span>
              {item.promoNote && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#581c6b] dark:text-[#F6C915] font-bold">
                    {item.promoNote}
                  </span>
                </>
              )}
            </div>

            <h3 className="font-display text-2xl font-bold text-[#2B0938] dark:text-white leading-snug text-balance mb-4">
              {item.name}
            </h3>

            <div className="pt-4 border-t border-purple-100 dark:border-purple-800/60">
              <p className="text-xs font-bold uppercase tracking-wider text-[#581c6b] dark:text-[#F6C915] mb-1.5">
                Aisle Note
              </p>
              <p className="text-sm text-slate-600 dark:text-purple-100/85 leading-relaxed">
                {item.funFact}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-purple-100 dark:border-purple-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75">
            <span>Item 1 of 1</span>
            <span className="font-mono font-bold text-[#2B0938] dark:text-[#F6C915] tabular-nums">
              {revealed ? formatGBP(item.pricePence) : 'Price Hidden'}
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="bg-white/95 dark:bg-[#220836]/95 border border-purple-200/80 dark:border-purple-800/70 rounded-2xl overflow-hidden flex flex-col shadow-sm">
      <div
        className={`relative aspect-[4/3] overflow-hidden flex items-center justify-center ${
          isStudioPackshot
            ? 'bg-white border-b border-purple-100 dark:border-purple-900/40 p-3'
            : 'bg-[#EEF2F6] dark:bg-[#190529]'
        }`}
      >
        {hasPhoto ? (
          <img
            src={item.image}
            alt={`${item.name} (${item.packSize})`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className={
              isStudioPackshot
                ? 'w-full h-full object-contain'
                : 'w-full h-full object-cover'
            }
          />
        ) : (
          <ProductPackVisual item={item} />
        )}

        {revealed && (
          <div className="absolute bottom-2.5 right-2.5 bg-[#F6C915] text-[#1D0830] px-2.5 py-1 rounded-lg shadow-sm border border-amber-300">
            <span className="font-mono text-sm font-extrabold tabular-nums">
              {formatGBP(item.pricePence)}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 dark:text-purple-200/75 mb-1">
            <span>{item.aisle}</span>
            <span aria-hidden="true">·</span>
            <span>{item.packSize}</span>
          </div>
          <h3 className="font-display text-base font-bold text-[#2B0938] dark:text-white leading-snug mb-2">
            {item.name}
          </h3>
          <p className="text-xs text-slate-600 dark:text-purple-100/80 leading-relaxed">
            {item.funFact}
          </p>
        </div>

        <div className="pt-2.5 border-t border-purple-100 dark:border-purple-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-purple-200/75">
          <span>
            Basket item {index + 1} of {totalInBasket}
            {item.promoNote ? ` · ${item.promoNote}` : ''}
          </span>
          <span className="font-mono font-bold text-[#2B0938] dark:text-[#F6C915] tabular-nums">
            {revealed ? formatGBP(item.pricePence) : '£?.??'}
          </span>
        </div>
      </div>
    </article>
  );
};
