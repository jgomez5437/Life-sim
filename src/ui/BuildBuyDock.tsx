import { Check, RotateCw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { CATALOG_BY_ID, CATALOG_CATEGORIES, CATALOG_ITEMS } from '../data/catalog';
import { useGameStore } from '../store/gameStore';
import type { CatalogCategory } from '../types/game';

export function BuildBuyDock() {
  const mode = useGameStore((s) => s.mode);
  const funds = useGameStore((s) => s.funds);
  const buildSelection = useGameStore((s) => s.buildSelection);

  const startBuildItem = useGameStore((s) => s.startBuildItem);
  const rotateBuildSelection = useGameStore((s) => s.rotateBuildSelection);
  const confirmBuildPlacement = useGameStore((s) => s.confirmBuildPlacement);
  const sellSelectedObject = useGameStore((s) => s.sellSelectedObject);
  const cancelBuildSelection = useGameStore((s) => s.cancelBuildSelection);

  const [category, setCategory] = useState<CatalogCategory | 'all'>('all');

  if (mode !== 'build') return null;

  const filteredItems =
    category === 'all'
      ? CATALOG_ITEMS
      : CATALOG_ITEMS.filter((item) => item.category === category);

  const selectedItem = buildSelection ? CATALOG_BY_ID[buildSelection.catalogId] : null;
  const refundPrice = selectedItem ? Math.round(selectedItem.price * 0.8) : 0;

  return (
    <>
      {buildSelection && selectedItem && (
        <div className="build-placement-bar glass-pill hud-interactive" id="build-placement-bar">
          <span className="build-placement-name">
            {selectedItem.name} • Tap floor to move
          </span>

          <button
            id="btn-build-rotate"
            type="button"
            className="build-action-btn"
            onClick={rotateBuildSelection}
          >
            <RotateCw size={14} />
            <span>Rotate</span>
          </button>

          {buildSelection.mode === 'move_existing' && (
            <button
              id="btn-build-sell"
              type="button"
              className="build-action-btn danger"
              onClick={sellSelectedObject}
            >
              <Trash2 size={14} />
              <span>Sell +§{refundPrice}</span>
            </button>
          )}

          <button
            id="btn-build-confirm"
            type="button"
            className="build-action-btn confirm"
            disabled={!buildSelection.isValid}
            onClick={confirmBuildPlacement}
          >
            <Check size={14} />
            <span>
              {buildSelection.mode === 'place_new'
                ? `Place §${selectedItem.price}`
                : 'Done'}
            </span>
          </button>

          <button
            id="btn-build-cancel"
            type="button"
            className="build-action-btn"
            onClick={cancelBuildSelection}
            aria-label="Cancel placement"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <section className="build-dock glass-pill hud-interactive" aria-label="Build and Buy Catalog">
        <div className="build-dock-top">
          <div className="build-cats" role="tablist" aria-label="Furniture categories">
            {CATALOG_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={category === cat.id}
                className={`cat-chip ${category === cat.id ? 'active' : ''}`}
                onClick={() => setCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="build-funds-pill">§{funds.toLocaleString()}</div>
        </div>

        <div className="build-items-strip">
          {filteredItems.map((item) => {
            const isSelected =
              buildSelection?.mode === 'place_new' && buildSelection.catalogId === item.id;
            const unaffordable = funds < item.price;

            return (
              <button
                key={item.id}
                id={`catalog-item-${item.id}`}
                type="button"
                className={`catalog-card ${isSelected ? 'selected' : ''}`}
                disabled={unaffordable}
                onClick={() => startBuildItem(item.id)}
              >
                <div className="catalog-swatch-row">
                  <span
                    className="catalog-swatch"
                    style={{
                      background: `linear-gradient(135deg, ${item.primaryColor} 55%, ${item.secondaryColor} 55%)`,
                    }}
                  />
                  <span className="catalog-price">§{item.price}</span>
                </div>
                <span className="catalog-name">{item.name}</span>
                <span className="catalog-size">
                  {item.footprint[0]}×{item.footprint[1]} tiles
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
