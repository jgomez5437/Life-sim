import { useEffect, useState } from 'react';
import { Check, RotateCw, Shirt, Sparkles, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { HairStyle, SimAppearance } from '../types/game';

type WardrobeTab = 'hair' | 'outfits';

const HAIR_STYLES: Array<{ id: HairStyle; label: string; tag: string }> = [
  { id: 'bun', label: 'Top Bun', tag: 'Updo' },
  { id: 'waves', label: 'Soft Waves', tag: 'Long' },
  { id: 'bob', label: 'Chic Bob', tag: 'Medium' },
  { id: 'pixie', label: 'Short Pixie', tag: 'Cropped' },
];

const HAIR_COLORS = [
  { name: 'Espresso', value: '#3b2820' },
  { name: 'Warm Chestnut', value: '#6a3e28' },
  { name: 'Honey Blonde', value: '#c99b56' },
  { name: 'Copper Auburn', value: '#9c4527' },
  { name: 'Midnight Ink', value: '#1f2329' },
  { name: 'Platinum Ash', value: '#d7d1c8' },
  { name: 'Rosewood', value: '#91465c' },
  { name: 'Ocean Teal', value: '#28727d' },
];

const SKIN_TONES = [
  { name: 'Porcelain', value: '#f6d8c3' },
  { name: 'Warm Peach', value: '#e8b691' },
  { name: 'Golden Sand', value: '#d89b72' },
  { name: 'Caramel', value: '#bd7c52' },
  { name: 'Warm Bronze', value: '#9b5f3d' },
  { name: 'Chestnut', value: '#7a482d' },
  { name: 'Deep Espresso', value: '#573322' },
  { name: 'Rich Mahogany', value: '#422519' },
];

const EYE_COLORS = [
  { name: 'Warm Hazel', value: '#4c382a' },
  { name: 'Amber Honey', value: '#85582d' },
  { name: 'Forest Green', value: '#3a6f4c' },
  { name: 'Ocean Blue', value: '#2f6f99' },
  { name: 'Storm Slate', value: '#516273' },
  { name: 'Deep Violet', value: '#5c447c' },
];

const TOP_COLORS = [
  { name: 'Coral Knit', value: '#e07a5f' },
  { name: 'Sage Meadow', value: '#5d9379' },
  { name: 'Coastal Navy', value: '#355070' },
  { name: 'Sunlit Ochre', value: '#dda145' },
  { name: 'Cream Linen', value: '#efe9dc' },
  { name: 'Lavender Dusk', value: '#8271a8' },
  { name: 'Charcoal', value: '#343a40' },
  { name: 'Terracotta Rose', value: '#c05a68' },
];

const BOTTOM_COLORS = [
  { name: 'Indigo Denim', value: '#3d5a80' },
  { name: 'Slate Charcoal', value: '#38414a' },
  { name: 'Warm Khaki', value: '#b89f7d' },
  { name: 'Olive Twill', value: '#556b4d' },
  { name: 'Light Wash', value: '#6f92b3' },
  { name: 'Espresso Cord', value: '#594236' },
  { name: 'Ivory Chino', value: '#dfd8cb' },
  { name: 'Berry Plum', value: '#6b3e57' },
];

const SHOE_COLORS = [
  { name: 'Cloud White', value: '#f4f1ea' },
  { name: 'Canvas Tan', value: '#c8a986' },
  { name: 'Midnight', value: '#2b3036' },
  { name: 'Sage Suede', value: '#668773' },
  { name: 'Terracotta', value: '#b85c48' },
  { name: 'Denim Blue', value: '#456488' },
];

const STYLE_PRESETS: Array<{
  id: string;
  name: string;
  subtitle: string;
  patch: Partial<SimAppearance>;
}> = [
  {
    id: 'coastal',
    name: 'Coastal Knit',
    subtitle: 'Coral & Denim',
    patch: {
      topColor: '#e07a5f',
      bottomColor: '#3d5a80',
      shoeColor: '#f4f1ea',
    },
  },
  {
    id: 'botanical',
    name: 'Botanical Chic',
    subtitle: 'Sage & Cream',
    patch: {
      topColor: '#5d9379',
      bottomColor: '#dfd8cb',
      shoeColor: '#c8a986',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Studio',
    subtitle: 'Ochre & Espresso',
    patch: {
      topColor: '#dda145',
      bottomColor: '#594236',
      shoeColor: '#f4f1ea',
    },
  },
  {
    id: 'evening',
    name: 'Evening Minimal',
    subtitle: 'Navy & Slate',
    patch: {
      topColor: '#355070',
      bottomColor: '#38414a',
      shoeColor: '#2b3036',
    },
  },
];

function HairPreviewIcon({ style, color }: { style: HairStyle; color: string }) {
  return (
    <svg viewBox="0 0 36 36" width="28" height="28" aria-hidden="true">
      <circle cx="18" cy="20" r="8.5" fill="#edd1bc" />
      {style === 'bun' && (
        <>
          <circle cx="18" cy="8.5" r="4.6" fill={color} />
          <path d="M9.5 19 C9.5 11.5, 26.5 11.5, 26.5 19 C23.5 15.5, 12.5 15.5, 9.5 19 Z" fill={color} />
        </>
      )}
      {style === 'waves' && (
        <>
          <path d="M8.5 18 C8.5 9.5, 27.5 9.5, 27.5 18 L28.5 29 C26 30, 24.5 29, 24 25 L24 18 C21 15, 15 15, 12 18 L12 25 C11.5 29, 10 30, 7.5 29 Z" fill={color} />
        </>
      )}
      {style === 'bob' && (
        <path d="M9 18.5 C9 10, 27 10, 27 18.5 L27.5 24 C25.5 25, 24 24.5, 24 22 L24 17.5 C21 14.8, 15 14.8, 12 17.5 L12 22 C12 24.5, 10.5 25, 8.5 24 Z" fill={color} />
      )}
      {style === 'pixie' && (
        <path d="M9.5 18.5 C9.5 10.5, 26.5 10.5, 26.5 18.5 C24 14.8, 13.5 15.2, 9.5 18.5 Z" fill={color} />
      )}
    </svg>
  );
}

export function WardrobePanel() {
  const wardrobeOpen = useGameStore((s) => s.wardrobeOpen);
  const sim = useGameStore((s) => s.sim);
  const updateSimAppearance = useGameStore((s) => s.updateSimAppearance);
  const closeWardrobe = useGameStore((s) => s.closeWardrobe);

  const [tab, setTab] = useState<WardrobeTab>('hair');

  useEffect(() => {
    if (!wardrobeOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWardrobe(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [wardrobeOpen, closeWardrobe]);

  if (!wardrobeOpen) return null;

  const { appearance } = sim;

  return (
    <>
      {/* Subtle 360° touch orbit hint anchored on the bottom-left while Maya is framed on the left */}
      <div className="wardrobe-orbit-hint glass-pill">
        <RotateCw size={14} />
        <span>Drag left side to rotate Maya 360°</span>
      </div>

      <aside
        className="wardrobe-panel glass-panel hud-interactive"
        aria-label="Create-a-Sim Wardrobe Studio"
      >
        <div className="wardrobe-header">
          <div>
            <span className="wardrobe-eyebrow">Wardrobe Studio</span>
            <h2 className="wardrobe-title">Style {sim.name}</h2>
          </div>
          <button
            id="btn-wardrobe-close"
            type="button"
            className="queue-cancel-btn"
            onClick={() => closeWardrobe(true)}
            aria-label="Close Wardrobe"
          >
            <X size={16} />
          </button>
        </div>

        <div className="wardrobe-tabs" role="tablist" aria-label="Customization category">
          <button
            id="tab-wardrobe-hair"
            type="button"
            role="tab"
            aria-selected={tab === 'hair'}
            className={`wardrobe-tab ${tab === 'hair' ? 'active' : ''}`}
            onClick={() => setTab('hair')}
          >
            <Sparkles size={14} />
            <span>Hair &amp; Face</span>
          </button>
          <button
            id="tab-wardrobe-outfits"
            type="button"
            role="tab"
            aria-selected={tab === 'outfits'}
            className={`wardrobe-tab ${tab === 'outfits' ? 'active' : ''}`}
            onClick={() => setTab('outfits')}
          >
            <Shirt size={14} />
            <span>Outfits</span>
          </button>
        </div>

        <div className="wardrobe-body">
          {tab === 'hair' ? (
            <>
              <section className="wardrobe-section">
                <h3 className="wardrobe-label">Hairstyle</h3>
                <div className="hairstyle-grid">
                  {HAIR_STYLES.map((style) => {
                    const active = appearance.hairStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        id={`btn-hair-${style.id}`}
                        type="button"
                        className={`hairstyle-card ${active ? 'active' : ''}`}
                        onClick={() => updateSimAppearance({ hairStyle: style.id })}
                      >
                        <HairPreviewIcon style={style.id} color={appearance.hairColor} />
                        <div className="hairstyle-meta">
                          <span className="hairstyle-name">{style.label}</span>
                          <span className="hairstyle-tag">{style.tag}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="wardrobe-section">
                <h3 className="wardrobe-label">Hair Color</h3>
                <div className="swatch-grid">
                  {HAIR_COLORS.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      className={`swatch-btn ${appearance.hairColor === swatch.value ? 'active' : ''}`}
                      style={{ background: swatch.value }}
                      onClick={() => updateSimAppearance({ hairColor: swatch.value })}
                      title={swatch.name}
                      aria-label={`Hair color ${swatch.name}`}
                    />
                  ))}
                </div>
              </section>

              <section className="wardrobe-section">
                <h3 className="wardrobe-label">Skin Tone</h3>
                <div className="swatch-grid">
                  {SKIN_TONES.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      className={`swatch-btn ${appearance.skinColor === swatch.value ? 'active' : ''}`}
                      style={{ background: swatch.value }}
                      onClick={() => updateSimAppearance({ skinColor: swatch.value })}
                      title={swatch.name}
                      aria-label={`Skin tone ${swatch.name}`}
                    />
                  ))}
                </div>
              </section>

              <section className="wardrobe-section">
                <h3 className="wardrobe-label">Eye Color</h3>
                <div className="swatch-grid six-col">
                  {EYE_COLORS.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      className={`swatch-btn ${appearance.eyeColor === swatch.value ? 'active' : ''}`}
                      style={{ background: swatch.value }}
                      onClick={() => updateSimAppearance({ eyeColor: swatch.value })}
                      title={swatch.name}
                      aria-label={`Eye color ${swatch.name}`}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="wardrobe-section">
                <h3 className="wardrobe-label">Curated Looks</h3>
                <div className="preset-grid">
                  {STYLE_PRESETS.map((preset) => {
                    const active =
                      appearance.topColor === preset.patch.topColor &&
                      appearance.bottomColor === preset.patch.bottomColor &&
                      appearance.shoeColor === preset.patch.shoeColor;
                    return (
                      <button
                        key={preset.id}
                        id={`btn-preset-${preset.id}`}
                        type="button"
                        className={`preset-card ${active ? 'active' : ''}`}
                        onClick={() => updateSimAppearance(preset.patch)}
                      >
                        <div className="preset-dots">
                          <span style={{ background: preset.patch.topColor }} />
                          <span style={{ background: preset.patch.bottomColor }} />
                          <span style={{ background: preset.patch.shoeColor }} />
                        </div>
                        <span className="preset-name">{preset.name}</span>
                        <span className="preset-sub">{preset.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="wardrobe-section">
                <h3 className="wardrobe-label">Top &amp; Knit</h3>
                <div className="swatch-grid">
                  {TOP_COLORS.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      className={`swatch-btn ${appearance.topColor === swatch.value ? 'active' : ''}`}
                      style={{ background: swatch.value }}
                      onClick={() => updateSimAppearance({ topColor: swatch.value })}
                      title={swatch.name}
                      aria-label={`Top color ${swatch.name}`}
                    />
                  ))}
                </div>
              </section>

              <section className="wardrobe-section">
                <h3 className="wardrobe-label">Bottoms</h3>
                <div className="swatch-grid">
                  {BOTTOM_COLORS.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      className={`swatch-btn ${appearance.bottomColor === swatch.value ? 'active' : ''}`}
                      style={{ background: swatch.value }}
                      onClick={() => updateSimAppearance({ bottomColor: swatch.value })}
                      title={swatch.name}
                      aria-label={`Bottom color ${swatch.name}`}
                    />
                  ))}
                </div>
              </section>

              <section className="wardrobe-section">
                <h3 className="wardrobe-label">Sneakers</h3>
                <div className="swatch-grid six-col">
                  {SHOE_COLORS.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      className={`swatch-btn ${appearance.shoeColor === swatch.value ? 'active' : ''}`}
                      style={{ background: swatch.value }}
                      onClick={() => updateSimAppearance({ shoeColor: swatch.value })}
                      title={swatch.name}
                      aria-label={`Sneaker color ${swatch.name}`}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="wardrobe-footer">
          <button
            id="btn-wardrobe-save"
            type="button"
            className="wardrobe-done-btn"
            onClick={() => closeWardrobe(true)}
          >
            <Check size={16} />
            <span>Done &amp; Save Look</span>
          </button>
        </div>
      </aside>
    </>
  );
}
