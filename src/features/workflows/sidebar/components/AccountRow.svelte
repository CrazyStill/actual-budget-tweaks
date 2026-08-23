<script lang="ts">
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import {
		getEmojiAssetUrl,
		removeAccountIcon,
		setAccountIcon,
	} from "@features/appearance/account-icon-picker";
	import IconPickerModal from "@features/appearance/account-icon-picker/Modal.svelte";
	import { closeCalendar, isCalendarOpen } from "@features/workflows/spending-calendar";
	import { navigate } from "@lib/utilities/actual-api";
	import { fmtMoney } from "@lib/utilities/currency";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { Smile } from "lucide-svelte";
	import { mount, unmount } from "svelte";
	import { autofocus } from "../actions/autofocus";
	import { tooltip } from "../actions/tooltip.svelte";
	import type { SidebarAccount } from "../lib/data";
	import StatusIcon from "./StatusIcon.svelte";

	// See PrimaryNav.svelte for why this watches DOM mutations rather than
	// `watchRoute`/history — cross-world navigation isn't observable there.
	let tick = $state({});

	$effect(() => {
		return watchDom(() => (tick = {}));
	});

	const {
		account,
		icon,
		dragging = false,
		dropPos = null,
		editing = false,
		onDragStart,
		onDragOver,
		onDrop,
		onDragEnd,
		onStartRename,
		onCommitRename,
		onCancelRename,
		onContextMenu,
		onRowMouseEnter,
		onRowMouseLeave,
	}: {
		account: SidebarAccount;
		icon: AccountIconData | undefined;
		dragging?: boolean;
		dropPos?: "before" | "after" | null;
		editing?: boolean;
		onDragStart?: (e: DragEvent) => void;
		onDragOver?: (e: DragEvent) => void;
		onDrop?: (e: DragEvent) => void;
		onDragEnd?: () => void;
		onStartRename?: () => void;
		onCommitRename?: (name: string) => void;
		onCancelRename?: () => void;
		onContextMenu?: (e: MouseEvent) => void;
		onRowMouseEnter?: (e: MouseEvent) => void;
		onRowMouseLeave?: () => void;
	} = $props();

	// Inline rename (triggered from AccountList's right-click context menu),
	// matching GroupHeader's editing pattern.
	let editValue = $state(account.name);

	function onRenameKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			onCommitRename?.(editValue);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			onCancelRename?.();
		}
	}

	// Overrides the `icon` prop once the user changes it here, so this row
	// reflects the change immediately without waiting for a full reload of
	// the icon cache from the parent.
	let iconOverride = $state<AccountIconData | null | undefined>(undefined);
	const effectiveIcon = $derived(iconOverride !== undefined ? iconOverride : icon);

	// Reads `tick` so this recomputes on route change (see the watchDom effect
	// above) without needing a `{#key}` block, which would tear down and
	// recreate this row's DOM on every tick — itself a mutation the shared
	// watchDom observer would see, re-triggering forever.
	const isSelected = $derived.by(() => {
		void tick;
		return location.pathname === `/accounts/${account.id}`;
	});

	function open() {
		if (isCalendarOpen()) closeCalendar();
		navigate(`/accounts/${account.id}`);
	}

	function openIconPicker(anchorRect: DOMRect) {
		if (document.querySelector('[data-abt-modal="experimental-icon-picker"]')) return;

		const container = document.createElement("div");
		container.dataset.abtModal = "experimental-icon-picker";

		let done = false;
		const cleanup = () => {
			if (done) return;
			done = true;
			unmount(instance);
			container.remove();
		};

		const instance = mount(IconPickerModal, {
			target: container,
			props: {
				accountId: account.id,
				accountName: account.name,
				hasIcon: Boolean(effectiveIcon),
				anchorRect,
				onSave: async (iconData: AccountIconData) => {
					await setAccountIcon(account.id, iconData);
					iconOverride = iconData;
					cleanup();
				},
				onRemove: async () => {
					await removeAccountIcon(account.id);
					iconOverride = null;
					cleanup();
				},
				onClose: cleanup,
			},
		});

		document.body.appendChild(container);
	}
</script>

{#if editing}
	<div class="account editing">
		<StatusIcon status={account.status} />
		{#if effectiveIcon}
			<span class="acct-icon">
				{#if effectiveIcon.type === "emoji"}
					<img
						class="acct-icon-img"
						src={getEmojiAssetUrl(effectiveIcon.value)}
						alt={effectiveIcon.value}
					/>
				{:else}
					<img class="acct-icon-img" src={effectiveIcon.value} alt="" />
				{/if}
			</span>
		{/if}
		<input
			class="account-rename"
			use:autofocus
			bind:value={editValue}
			onkeydown={onRenameKeydown}
			onblur={() => onCommitRename?.(editValue)}
		/>
	</div>
{:else}
	<button
		type="button"
		class="account"
		class:dragging
		class:selected={isSelected}
		class:drop-before={dropPos === "before"}
		class:drop-after={dropPos === "after"}
		draggable="true"
		onclick={open}
		ondblclick={() => {
			editValue = account.name;
			onStartRename?.();
		}}
		oncontextmenu={onContextMenu}
		ondragstart={onDragStart}
		ondragover={onDragOver}
		ondrop={onDrop}
		ondragend={onDragEnd}
		onmouseenter={onRowMouseEnter}
		onmouseleave={onRowMouseLeave}
	>
		<span
			class="acct-glyph"
			class:has-icon={!!effectiveIcon}
			role="button"
			tabindex="-1"
			aria-label="Change icon"
			use:tooltip={{ text: "Change icon", placement: "right" }}
			onclick={(e) => {
				e.stopPropagation();
				openIconPicker((e.currentTarget as HTMLElement).getBoundingClientRect());
			}}
			onkeydown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
					openIconPicker((e.currentTarget as HTMLElement).getBoundingClientRect());
				}
			}}
		>
			<StatusIcon status={account.status} />
			{#if effectiveIcon}
				<span class="acct-icon">
					{#if effectiveIcon.type === "emoji"}
						<img
							class="acct-icon-img"
							src={getEmojiAssetUrl(effectiveIcon.value)}
							alt={effectiveIcon.value}
						/>
					{:else}
						<img class="acct-icon-img" src={effectiveIcon.value} alt="" />
					{/if}
				</span>
			{/if}
			<span class="acct-glyph-edit" aria-hidden="true"><Smile strokeWidth={1.5} /></span>
		</span>
		<span class="account-name">{account.name}</span>
		{#if account.uncategorized > 0}
			<span class="account-uncat">{account.uncategorized}</span>
		{/if}
		<span class="account-amount abt-privacy-number" class:red={account.balance < 0}
			>{fmtMoney(account.balance)}</span
		>
	</button>
{/if}
