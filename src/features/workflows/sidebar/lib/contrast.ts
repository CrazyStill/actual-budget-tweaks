// Derives text/border/hover colors from the sidebar's actual resolved
// background (WCAG luminance + HSL) rather than trusting individual theme
// tokens, so warm/cool themes get a matching tint instead of flat gray.

function parseRgb(value: string): [number, number, number] | null {
	const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
	if (!match) return null;
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance(r: number, g: number, b: number): number {
	const channel = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Standard RGB → HSL, normalized to 0-1 (not 0-360/0-100). */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l };

	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
	else if (max === g) h = (b - r) / d + 2;
	else h = (r - g) / d + 4;
	return { h: (h / 6) * 360, s, l };
}

export function isDarkBackground(el: HTMLElement): boolean {
	const rgb = parseRgb(getComputedStyle(el).backgroundColor);
	if (!rgb) return true;
	return relativeLuminance(...rgb) < 0.5;
}

// Fixed status colors, deliberately not theme-derived — a mismapped
// --color-noticeText in this extension's own Catppuccin theme once broke
// "synced" silently, and status meaning has to survive any theme.
const STATUS_COLORS = {
	dark: { success: "#3fb950", danger: "#f85149", attention: "#d29922" },
	light: { success: "#1a7f37", danger: "#cf222e", attention: "#9a6700" },
} as const;

// Caps how much of the background's own saturation carries over into the
// derived foreground — a vivid/saturated background (e.g. a bold accent
// color used as the sidebar background) shouldn't produce an equally vivid
// foreground, just a subtle tint of it.
const MAX_FG_SATURATION = 0.35;

// Sets --sb-computed-fg to a readable foreground tinted from el's own
// resolved background (same hue/capped saturation, pushed to readable
// lightness) — every other token in sidebar.css derives from it via
// color-mix(). Also sets the fixed status colors for the same mode.
export function applyComputedForeground(el: HTMLElement): void {
	const rgb = parseRgb(getComputedStyle(el).backgroundColor);
	const dark = !rgb || relativeLuminance(...rgb) < 0.5;
	const { h, s } = rgb ? rgbToHsl(...rgb) : { h: 0, s: 0 };

	const satPct = (Math.min(s, MAX_FG_SATURATION) * 100).toFixed(1);
	const lightPct = dark ? 92 : 13;
	el.style.setProperty("--sb-computed-fg", `hsl(${h.toFixed(1)} ${satPct}% ${lightPct}%)`);

	const status = dark ? STATUS_COLORS.dark : STATUS_COLORS.light;
	el.style.setProperty("--sb-success", status.success);
	el.style.setProperty("--sb-danger", status.danger);
	el.style.setProperty("--sb-attention", status.attention);
}
