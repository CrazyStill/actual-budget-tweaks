// Plain `autofocus` only requests focus and can be skipped for dynamically
// inserted elements — `.focus()` at mount is guaranteed to fire.
export function autofocus(node: HTMLInputElement) {
	node.focus();
	node.select();
}
