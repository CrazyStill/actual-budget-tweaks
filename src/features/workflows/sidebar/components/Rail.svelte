<script lang="ts">
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import { closeCalendar, isCalendarOpen, openCalendar } from "@features/workflows/spending-calendar";
	import IconPickerPopover from "@lib/components/IconPickerPopover.svelte";
	import { dispatch, navigate } from "@lib/utilities/actual-api";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { Page, matchesPage } from "@lib/utilities/pages";
	import { getValue } from "@lib/utilities/store";
	import {
		Banknote,
		Calendar,
		CalendarDays,
		ChartColumn,
		LayoutGrid,
		List,
		PanelLeftClose,
		PanelLeftOpen,
		Plus,
		Search,
		Settings,
		SlidersHorizontal,
		Tag,
		Users,
	} from "lucide-svelte";
	import { scrollFade } from "../actions/scroll-fade";
	import { tooltip } from "../actions/tooltip.svelte";
	import type { BudgetIcon } from "../lib/budgets";
	import { loadBudgetIcon, removeBudgetIcon, setBudgetIcon } from "../lib/budgets";
	import type { SidebarAccount } from "../lib/data";
	import { triggerSearch } from "../lib/search";

	// See PrimaryNav.svelte for why this watches DOM mutations rather than
	// `watchRoute`/history — cross-world navigation isn't observable there,
	// and why `isActive` (not a sibling `{@const}`) is what makes the
	// `class:active` binding itself depend on `tick`.
	let tick = $state({});

	$effect(() => {
		return watchDom(() => (tick = {}));
	});

	function isActive(page: Page): boolean {
		return Boolean(tick) && matchesPage(page);
	}

	// Same route check AccountRow.svelte uses for its own .selected state.
	function isAccountSelected(id: string): boolean {
		return Boolean(tick) && location.pathname === `/accounts/${id}`;
	}

	// See PrimaryNav.svelte for the full explanation of both of these.
	let calendarFeatureEnabled = $state(false);

	$effect(() => {
		getValue<boolean>("spending-calendar-enabled", false).then((v) => (calendarFeatureEnabled = v));
	});

	function go(page: Page) {
		if (isCalendarOpen()) closeCalendar();
		navigate(`/${page}`);
	}

	const {
		budgetName,
		budgetId,
		accounts,
		icons,
		onExpand,
		vscode = false,
		panelCollapsed = false,
		onTogglePanel,
		onSwitchLayout,
	}: {
		budgetName: string;
		budgetId?: string;
		accounts: SidebarAccount[];
		icons: Record<string, AccountIconData>;
		onExpand: () => void;
		// vscode: this rail is the always-on activity bar of the VS Code-style
		// layout (see Sidebar.svelte) rather than the classic layout's
		// collapsed-rail substitute — it carries the full nav (moreItems below)
		// since no PrimaryNav exists alongside it, and only takes over showing
		// accounts itself while its companion accounts panel is collapsed.
		vscode?: boolean;
		panelCollapsed?: boolean;
		onTogglePanel?: () => void;
		onSwitchLayout?: () => void;
	} = $props();

	let budgetIcon = $state<BudgetIcon | undefined>(undefined);
	let iconBtnEl = $state<HTMLButtonElement | undefined>();
	let iconPickerOpen = $state(false);
	let iconAnchorRect = $state<DOMRect | undefined>(undefined);

	$effect(() => {
		if (!budgetId) {
			budgetIcon = undefined;
			return;
		}
		loadBudgetIcon(budgetId).then((icon) => (budgetIcon = icon));
	});

	function openIconPicker(): void {
		if (!iconBtnEl) return;
		iconAnchorRect = iconBtnEl.getBoundingClientRect();
		iconPickerOpen = true;
	}

	async function handleIconSelect(result: BudgetIcon): Promise<void> {
		budgetIcon = result;
		iconPickerOpen = false;
		if (budgetId) await setBudgetIcon(budgetId, result);
	}

	async function handleIconRemove(): Promise<void> {
		budgetIcon = undefined;
		iconPickerOpen = false;
		if (budgetId) await removeBudgetIcon(budgetId);
	}

	const navItems = [
		{ label: "Budget", page: Page.Budget, icon: LayoutGrid },
		{ label: "Reports", page: Page.Reports, icon: ChartColumn },
		{ label: "Schedules", page: Page.Schedules, icon: Calendar },
	];

	// Only shown in vscode mode — see the `vscode` prop doc above.
	const moreItems = [
		{ label: "Payees", page: Page.Payees, icon: Users },
		{ label: "Bank Sync", page: Page.BankSync, icon: Banknote },
		{ label: "Rules", page: Page.Rules, icon: SlidersHorizontal },
		{ label: "Tags", page: Page.Tags, icon: Tag },
		{ label: "Settings", page: Page.Settings, icon: Settings },
	];

	const budgetInitials = $derived(
		budgetName
			.split(/\s+/)
			.map((w) => w[0])
			.join("")
			.slice(0, 2)
			.toUpperCase(),
	);

	function accountInitials(name: string): string {
		const words = name.trim().split(/\s+/);
		if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
		return name
			.replace(/[^a-z0-9]/gi, "")
			.slice(0, 2)
			.toUpperCase();
	}

	const sections = $derived(
		[
			{ label: "On Budget", items: accounts.filter((a) => !a.offbudget && !a.closed) },
			{ label: "Off Budget", items: accounts.filter((a) => a.offbudget && !a.closed) },
			{ label: "Closed", items: accounts.filter((a) => a.closed) },
		].filter((s) => s.items.length > 0),
	);

	async function addAccount() {
		await dispatch("pushModal", { modal: { name: "add-account", options: {} } });
	}
</script>

<button
	type="button"
	class="rail-avatar"
	class:has-icon={vscode && !!budgetIcon}
	bind:this={iconBtnEl}
	onclick={vscode ? openIconPicker : onExpand}
	aria-label={vscode ? "Change budget icon" : `${budgetName} — expand`}
	use:tooltip={vscode ? "Change budget icon" : `${budgetName} — expand`}
>
	{#if vscode && budgetIcon?.type === "emoji"}
		<span class="budget-icon-emoji">{budgetIcon.value}</span>
	{:else if vscode && budgetIcon}
		<img class="budget-icon-img" src={budgetIcon.value} alt="" />
	{:else}
		{budgetInitials}
	{/if}
</button>

{#if iconPickerOpen && iconAnchorRect}
	<IconPickerPopover
		anchorRect={iconAnchorRect}
		hasIcon={!!budgetIcon}
		onSelect={handleIconSelect}
		onRemove={budgetIcon ? handleIconRemove : undefined}
		onClose={() => (iconPickerOpen = false)}
	/>
{/if}
<button type="button" class="rail-icon" onclick={triggerSearch} aria-label="Search" use:tooltip={"Search (⌘K)"}>
	<Search strokeWidth={1.5} />
</button>
<div class="rail-nav">
	{#each navItems as item (item.page)}
		<button
			type="button"
			class="rail-icon"
			class:active={isActive(item.page)}
			onclick={() => go(item.page)}
			aria-label={item.label}
			use:tooltip={item.label}
		>
			<item.icon strokeWidth={1.5} />
		</button>
	{/each}
	{#if calendarFeatureEnabled}
		<button
			type="button"
			class="rail-icon"
			class:active={isActive(Page.Calendar)}
			onclick={() => openCalendar()}
			aria-label="Calendar"
			use:tooltip={"Calendar"}
		>
			<CalendarDays strokeWidth={1.5} />
		</button>
	{/if}
</div>
{#if vscode}
	<div class="rail-divider"></div>
	<div class="rail-nav">
		{#each moreItems as item (item.page)}
			<button
				type="button"
				class="rail-icon"
				class:active={isActive(item.page)}
				onclick={() => go(item.page)}
				aria-label={item.label}
				use:tooltip={item.label}
			>
				<item.icon strokeWidth={1.5} />
			</button>
		{/each}
	</div>
{/if}
{#if !vscode || panelCollapsed}
	<div class="rail-divider"></div>
	<div class="rail-list" use:scrollFade>
		{#each sections as section (section.label)}
			{@const [first, ...rest] = section.label.split(" ")}
			<div class="rail-section" use:tooltip={section.label}>
				{first}{#if rest.length}<small>{rest.join(" ")}</small>{/if}
			</div>
			{#each section.items as account (account.id)}
				{@const icon = icons[account.id]}
				<button
					type="button"
					class="rtile-wrap"
					class:selected={isAccountSelected(account.id)}
					aria-label={account.name}
					use:tooltip={account.name}
					onclick={() => {
						if (isCalendarOpen()) closeCalendar();
						navigate(`/accounts/${account.id}`);
					}}
				>
					<span class="rtile">
						{#if icon?.type === "emoji"}
							<span class="rtile-emoji">{icon.value}</span>
						{:else if icon}
							<img class="rtile-img" src={icon.value} alt="" />
						{:else}
							{accountInitials(account.name)}
						{/if}
					</span>
				</button>
			{/each}
		{/each}
	</div>
{:else}
	<div class="rail-spacer"></div>
{/if}
<div class="rail-foot">
	{#if vscode}
		<button
			type="button"
			class="rail-icon"
			onclick={onTogglePanel}
			aria-label={panelCollapsed ? "Show accounts panel" : "Hide accounts panel"}
			use:tooltip={panelCollapsed ? "Show accounts panel" : "Hide accounts panel"}
		>
			{#if panelCollapsed}
				<PanelLeftOpen strokeWidth={1.5} />
			{:else}
				<PanelLeftClose strokeWidth={1.5} />
			{/if}
		</button>
		<button
			type="button"
			class="rail-icon"
			onclick={onSwitchLayout}
			aria-label="Switch to standard layout"
			use:tooltip={"Switch to standard layout"}
		>
			<List strokeWidth={1.5} />
		</button>
	{:else}
		<button
			type="button"
			class="rail-icon"
			onclick={addAccount}
			aria-label="Add account"
			use:tooltip={"Add account"}
		>
			<Plus strokeWidth={2.2} />
		</button>
		<button
			type="button"
			class="rail-icon"
			onclick={onExpand}
			aria-label="Expand sidebar"
			use:tooltip={"Expand sidebar"}
		>
			<PanelLeftOpen strokeWidth={1.5} />
		</button>
	{/if}
</div>
