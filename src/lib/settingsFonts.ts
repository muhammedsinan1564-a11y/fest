import { fontStack, loadFonts } from './fonts';
import { SETTINGS_FONTS } from './settings-fonts';

export { SETTINGS_FONTS };

export interface UiFontSettings {
  uiFontId: 'jakarta' | 'dm-sans' | 'space-grotesk' | 'system';
  displayFontId: 'space-grotesk' | 'syne' | 'fraunces';
  scale: 'compact' | 'comfortable' | 'spacious';
  /** Overrides uiFontId when set — a family from SETTINGS_FONTS. */
  uiFontName?: string;
  /** Overrides displayFontId when set — a family from SETTINGS_FONTS. */
  headingFontName?: string;
}

export const UI_FONT_OPTIONS: Array<{
  id: UiFontSettings['uiFontId'];
  label: string;
  stack: string;
  description: string;
}> = [
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans',
    stack: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    description: 'Balanced studio sans with clean numerals',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    stack: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    description: 'Low-contrast geometric UI clarity',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    stack: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    description: 'Technical broadcast desk aesthetic',
  },
  {
    id: 'system',
    label: 'System Native',
    stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    description: 'Zero-latency OS native interface font',
  },
];

export const DISPLAY_FONT_OPTIONS: Array<{
  id: UiFontSettings['displayFontId'];
  label: string;
  stack: string;
}> = [
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    stack: "'Space Grotesk', sans-serif",
  },
  {
    id: 'syne',
    label: 'Syne Display',
    stack: "'Syne', sans-serif",
  },
  {
    id: 'fraunces',
    label: 'Fraunces Editorial',
    stack: "'Fraunces', serif",
  },
];

export const SCALE_VALUES: Record<UiFontSettings['scale'], number> = {
  compact: 0.94,
  comfortable: 1,
  spacious: 1.06,
};

export const DEFAULT_UI_FONT_SETTINGS: UiFontSettings = {
  uiFontId: 'jakarta',
  displayFontId: 'space-grotesk',
  scale: 'comfortable',
};

export function applyUiFontSettings(settings: UiFontSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const uiOption =
    UI_FONT_OPTIONS.find((opt) => opt.id === settings.uiFontId) ?? UI_FONT_OPTIONS[0];
  const displayOption =
    DISPLAY_FONT_OPTIONS.find((opt) => opt.id === settings.displayFontId) ??
    DISPLAY_FONT_OPTIONS[0];
  const scaleValue = SCALE_VALUES[settings.scale] ?? 1;

  const uiName = settings.uiFontName;
  const headingName = settings.headingFontName;
  if (uiName) loadFonts([uiName]);
  if (headingName) loadFonts([headingName]);

  root.style.setProperty('--fz-font-ui', uiName ? fontStack(uiName) : uiOption.stack);
  root.style.setProperty(
    '--fz-font-display',
    headingName ? fontStack(headingName) : displayOption.stack
  );
  root.style.setProperty('--fz-ui-scale', String(scaleValue));
}

/** The families offered in the Settings font selectors (exactly 50). */
export const SETTINGS_FONT_OPTIONS: ReadonlyArray<string> = SETTINGS_FONTS;
