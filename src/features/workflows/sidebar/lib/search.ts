// Dispatches the same synthetic ⌘K keydown sidebar-search.ts uses to
// trigger Actual's real command palette, instead of building a second one.
export function isMac(): boolean {
	return navigator.platform?.includes("Mac") ?? navigator.userAgent.includes("Mac");
}

export function triggerSearch(): void {
	document.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "k",
			code: "KeyK",
			metaKey: isMac(),
			ctrlKey: !isMac(),
			bubbles: true,
		}),
	);
}
