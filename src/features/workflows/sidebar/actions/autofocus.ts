// A same-tick `.focus()` call can silently no-op — the element hasn't been
// through a layout/paint pass yet (freshly inserted this task, or reparented
// by a portal action right after this one runs), so the browser doesn't
// treat it as focusable yet. Deferring to the next frame guarantees the
// element has actually been laid out first.
export function autofocus(node: HTMLInputElement) {
	requestAnimationFrame(() => {
		node.focus();
		node.select();
	});
}
