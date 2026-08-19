export function isMac(): boolean {
	return navigator.platform?.includes("Mac") ?? navigator.userAgent.includes("Mac");
}
