export function autofocus(node: HTMLInputElement) {
	requestAnimationFrame(() => {
		node.focus();
		node.select();
	});
}
