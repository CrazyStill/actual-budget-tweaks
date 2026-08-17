<script lang="ts">
	// Fixed, varied widths so the placeholder rows read as text rather than a
	// uniform grid — real account names aren't all the same length either.
	const rowWidths = [72, 54, 85, 46, 66, 60, 55, 80, 62, 58];
</script>

<div class="skel-list" aria-hidden="true">
	{#each rowWidths as width, i (i)}
		<div class="skel-row">
			<span class="skel-glyph"></span>
			<span class="skel-name" style="width: {width}%"></span>
			<span class="skel-amount"></span>
		</div>
	{/each}
</div>
