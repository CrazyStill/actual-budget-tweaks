<script lang="ts">
	import type { SyncStatus } from "../lib/data";

	const { status }: { status: SyncStatus } = $props();
</script>

<!-- Real bank-sync status glyph (see data.ts's `sync_status` → SyncStatus
     mapping). Shared between AccountRow's small badge and the hover card's
     larger uses of the same status, rather than duplicating the SVG twice. -->
<span class="status status-{status}" aria-label={status}>
	{#if status === "synced"}
		<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
			<circle cx="24" cy="24" r="9" fill="currentColor" />
		</svg>
	{:else if status === "syncing"}
		<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
			<circle cx="24" cy="24" r="4.6" fill="currentColor" />
			<g class="orbit">
				<path d="M24 24m-11,0 a11,11 0 0 1 19.5,-6.8" stroke-width="3.4" stroke-linecap="round" />
			</g>
		</svg>
	{:else if status === "error"}
		<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
			<circle cx="24" cy="24" r="6.5" fill="currentColor" stroke="none" />
			<circle class="ring-pulse" cx="24" cy="24" r="13" stroke-width="3" />
		</svg>
	{:else}
		<svg
			viewBox="0 0 48 48"
			fill="none"
			stroke="currentColor"
			stroke-width="3.4"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle cx="24" cy="24" r="8" />
		</svg>
	{/if}
</span>
