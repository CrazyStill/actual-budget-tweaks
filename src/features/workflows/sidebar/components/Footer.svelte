<script lang="ts">
	import { dispatch } from "@lib/utilities/actual-api";
	import { Columns2, PanelLeftClose, Plus, Redo2, Undo2 } from "lucide-svelte";
	import { tooltip } from "../actions/tooltip.svelte";

	const { onCollapse, onSwitchLayout }: { onCollapse?: () => void; onSwitchLayout?: () => void } = $props();

	async function addAccount() {
		await dispatch("pushModal", { modal: { name: "add-account", options: {} } });
	}

	async function undo() {
		await dispatch("undo");
	}

	async function redo() {
		await dispatch("redo");
	}
</script>

<div class="footer">
	<button type="button" class="add-account" onclick={addAccount}>
		<Plus class="plus" strokeWidth={2.2} />
		<span>Add account</span>
	</button>
	<div class="footer-actions">
		<button
			type="button"
			class="collapse"
			aria-label="Undo"
			use:tooltip={{ text: "Undo", placement: "top" }}
			onclick={undo}
		>
			<Undo2 strokeWidth={1.5} />
		</button>
		<button
			type="button"
			class="collapse"
			aria-label="Redo"
			use:tooltip={{ text: "Redo", placement: "top" }}
			onclick={redo}
		>
			<Redo2 strokeWidth={1.5} />
		</button>
		{#if onSwitchLayout}
			<button
				type="button"
				class="collapse"
				aria-label="Switch to VS Code-style layout"
				use:tooltip={{ text: "Switch to VS Code-style layout", placement: "top" }}
				onclick={onSwitchLayout}
			>
				<Columns2 strokeWidth={1.5} />
			</button>
		{/if}
		{#if onCollapse}
			<button
				type="button"
				class="collapse"
				aria-label="Collapse sidebar"
				use:tooltip={{ text: "Collapse sidebar", placement: "top" }}
				onclick={onCollapse}
			>
				<PanelLeftClose strokeWidth={1.5} />
			</button>
		{/if}
	</div>
</div>
