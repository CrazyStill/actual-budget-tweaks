<script lang="ts">
	// Standalone port of the "Actual Budget — Sidebar" Figma frame (node 46:890).
	// Self-contained test component: Catppuccin Mocha palette, sample data below.
	import emojiData from "unicode-emoji-json/data-by-group.json";
	import "./ExperimentalSidebar.css";
	// Icons: lucide-svelte (ISC license, https://lucide.dev), a maintained fork of
	// Feather Icons (MIT) — a definitive, attributable source rather than
	// hand-drawn/AI-authored art. The sync-status dot grammar below (statusIcon)
	// is intentionally bespoke and has no library equivalent.
	import {
		Archive,
		ArrowUpRight,
		Calendar,
		ChartColumn,
		Check,
		ChevronDown,
		ChevronsUpDown,
		CloudCheck,
		CloudDownload,
		CloudOff,
		Download,
		Ellipsis,
		Landmark,
		LayoutGrid,
		Link,
		List,
		ListTree,
		LogOut,
		Moon,
		PanelLeftClose,
		PanelLeftOpen,
		Pencil,
		Plus,
		RefreshCw,
		Scale,
		Search,
		Settings,
		SlidersHorizontal,
		Smile,
		Sun,
		Tag,
		Ungroup,
		Unlink,
		Upload,
		Users,
		X,
	} from "lucide-svelte";

	// Sync-status "dot grammar": fill = connection, motion = activity.
	//   synced  → solid dot        manual → hollow dot
	//   syncing → orbiting arc      error  → solid dot in a pulsing alert ring
	type Status = "synced" | "syncing" | "error" | "manual";

	// Optional per-account icon (emoji, fetched logo, or uploaded image) — mirrors ABT.
	interface AccountIcon {
		type: "emoji" | "url" | "dataUrl";
		value: string;
	}

	interface Account {
		name: string;
		amount: string; // pre-formatted
		status: Status;
		negative?: boolean;
		icon?: AccountIcon;
		uncategorized?: number; // count of transactions with no category
	}

	interface Group {
		id?: string; // stable identity (labels can collide / change)
		label: string;
		total?: string;
		accounts: Account[];
	}

	interface Section {
		label: string;
		total: string;
		muted?: boolean; // dimmer label (e.g. Closed)
		groups: Group[]; // a group with an empty label renders its accounts directly
	}

	const grandTotal = "313,914.37";

	let sections = $state<Section[]>([
		{
			label: "On Budget",
			total: "34,872.12",
			groups: [
				{
					label: "",
					accounts: [
						{ name: "Everyday Checking", amount: "12,450.30", status: "synced", uncategorized: 3 },
						{ name: "Joint Checking", amount: "3,673.45", status: "synced" },
					],
				},
				{
					label: "Credit Cards",
					accounts: [
						{
							name: "Sapphire Rewards Card",
							amount: "-1,245.67",
							status: "synced",
							negative: true,
							uncategorized: 12,
						},
						{ name: "Everyday Cashback Card", amount: "-892.33", status: "synced", negative: true },
					],
				},
				{
					label: "Savings",
					accounts: [
						{ name: "Emergency Fund", amount: "6,230.18", status: "synced" },
						{ name: "Vacation Fund", amount: "5,890.75", status: "manual" },
						{ name: "High-Yield Savings", amount: "8,765.44", status: "synced" },
					],
				},
			],
		},
		{
			label: "Off Budget",
			total: "279,042.25",
			groups: [
				{
					label: "Investments",
					accounts: [
						{ name: "Brokerage Account", amount: "42,318.90", status: "synced", uncategorized: 1 },
						{ name: "Company RSUs", amount: "18,760.25", status: "synced" },
						{ name: "Roth IRA", amount: "27,540.60", status: "synced" },
						{ name: "401(k)", amount: "63,215.80", status: "syncing" },
						{ name: "HSA Investment", amount: "4,982.15", status: "error" },
						{ name: "Crypto Wallet", amount: "2,145.30", status: "manual" },
					],
				},
				{
					label: "Assets",
					accounts: [{ name: "House Asset", amount: "420,000.00", status: "manual" }],
				},
				{
					label: "Loans",
					accounts: [
						{ name: "Mortgage", amount: "-285,600.00", status: "synced", negative: true },
						{ name: "Auto Loan", amount: "-14,320.75", status: "synced", negative: true },
					],
				},
			],
		},
		{
			label: "Closed",
			total: "0.00",
			muted: true,
			groups: [],
		},
	]);

	const navItems = ["Budget", "Reports", "Schedules"] as const;
	const moreItems = ["Payees", "Rules", "Bank Sync", "Tags", "Settings"] as const;

	// ---- interactive state ----
	// One global active page across nav links, "More" sub-links, section labels and accounts.
	let activePage = $state<string>("Budget");
	let moreExpanded = $state(false);
	let collapsedSections = $state<Record<string, boolean>>({});
	let collapsedGroups = $state<Record<string, boolean>>({});
	let groupAccounts = $state(true); // false = flat list under each section (no sub-categories)
	// edge-fade mask for the scrollable accounts list. "top" = scrolled to the top
	// (fade the bottom only), which is the correct state on load. "none" = the list
	// fits without scrolling, so no fade at all.
	let accountsMaskState = $state<"none" | "top" | "middle" | "bottom">("top");
	let accountsEl = $state<HTMLElement | null>(null);
	const accountsMask = $derived(
		accountsMaskState === "none"
			? "none"
			: accountsMaskState === "top"
				? "linear-gradient(black 0%, black calc(100% - 34px), transparent 100%)"
				: accountsMaskState === "bottom"
					? "linear-gradient(transparent 0px, black 34px, black 100%)"
					: "linear-gradient(transparent 0px, black 34px, black calc(100% - 34px), transparent 100%)",
	);

	// ---- budget selector ----
	type BudgetState = "syncing" | "downloadable" | "local";
	interface Budget {
		name: string;
		state: BudgetState;
	}
	let budgets = $state<Budget[]>([
		{ name: "Sample Budget", state: "syncing" },
		{ name: "Test Budget", state: "downloadable" },
		{ name: "Demo Budget", state: "local" },
	]);
	const budgetStateLabel = (s: BudgetState) =>
		s === "syncing" ? "Syncing" : s === "downloadable" ? "Available for download" : "Local";
	let currentBudget = $state("Sample Budget");
	let budgetOpen = $state(false);
	let editingBudget = $state(false);
	let editValue = $state("");
	let budgetEl = $state<HTMLElement | null>(null);

	function closeBudget() {
		budgetOpen = false;
		editingBudget = false;
	}
	function selectBudget(b: Budget) {
		currentBudget = b.name;
		closeBudget();
	}
	function closeFile() {
		// Placeholder: in the real app this exits the open budget back to the file-list screen.
		closeBudget();
	}
	function startEdit() {
		editValue = currentBudget;
		editingBudget = true;
	}
	function commitEdit() {
		const v = editValue.trim();
		if (v) {
			const b = budgets.find((x) => x.name === currentBudget);
			if (b) b.name = v;
			currentBudget = v;
		}
		editingBudget = false;
	}
	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitEdit();
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			editingBudget = false;
		}
	}
	function autofocus(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
	function handleWindowClick(e: MouseEvent) {
		if (budgetOpen && budgetEl && !budgetEl.contains(e.target as Node)) closeBudget();
		if (menuAccount || menuGroup) closeMenus();
		if (iconAccount && iconPickerEl && !iconPickerEl.contains(e.target as Node)) closeIconPicker();
	}
	function updateAccountsMask(el: HTMLElement) {
		const maxScroll = el.scrollHeight - el.clientHeight;
		if (maxScroll <= 1) {
			accountsMaskState = "none";
			return;
		}
		const atTop = el.scrollTop <= 0;
		const atBottom = el.scrollTop >= maxScroll - 1;
		accountsMaskState = atTop ? "top" : atBottom ? "bottom" : "middle";
	}
	function handleAccountsScroll(event: Event) {
		updateAccountsMask(event.currentTarget as HTMLElement);
		hideHoverCard();
		if (menuAccount || menuGroup) closeMenus();
	}
	// set the correct mask once the list mounts / re-mounts (e.g. expanding the rail)
	$effect(() => {
		if (accountsEl) updateAccountsMask(accountsEl);
	});

	// ---- theme (dark default, light optional) ----
	let theme = $state<"dark" | "light">("dark");
	function toggleTheme() {
		theme = theme === "dark" ? "light" : "dark";
	}
	// reflect the theme onto the host document so the surrounding page can match
	$effect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.dataset.sidebarTheme = theme;
		}
	});

	// ---- custom tooltip (replaces native title=) ----
	type TipPlacement = "right" | "left" | "top" | "bottom";
	type TipOpts = { text: string; placement?: TipPlacement };
	let tip = $state<{ text: string; x: number; y: number; placement: TipPlacement } | null>(null);
	let tipTimer: ReturnType<typeof setTimeout> | null = null;
	const TIP_DELAY = 320;

	function placeTip(el: HTMLElement, o: Required<TipOpts>) {
		const r = el.getBoundingClientRect();
		const gap = 9;
		let x = 0;
		let y = 0;
		if (o.placement === "right") {
			x = r.right + gap;
			y = r.top + r.height / 2;
		} else if (o.placement === "left") {
			x = r.left - gap;
			y = r.top + r.height / 2;
		} else if (o.placement === "top") {
			x = r.left + r.width / 2;
			y = r.top - gap;
		} else {
			x = r.left + r.width / 2;
			y = r.bottom + gap;
		}
		tip = { text: o.text, x, y, placement: o.placement };
	}
	function hideTip() {
		if (tipTimer) {
			clearTimeout(tipTimer);
			tipTimer = null;
		}
		tip = null;
	}
	function tooltip(node: HTMLElement, param: string | TipOpts) {
		let o: Required<TipOpts> = {
			text: "",
			placement: "right",
			...(typeof param === "string" ? { text: param } : param),
		};
		const enter = () => {
			if (tipTimer) clearTimeout(tipTimer);
			if (!o.text) return;
			tipTimer = setTimeout(() => placeTip(node, o), TIP_DELAY);
		};
		const leave = () => hideTip();
		node.addEventListener("pointerenter", enter);
		node.addEventListener("pointerleave", leave);
		node.addEventListener("pointerdown", leave);
		node.addEventListener("focusin", enter);
		node.addEventListener("focusout", leave);
		return {
			update(next: string | TipOpts) {
				o = { text: "", placement: "right", ...(typeof next === "string" ? { text: next } : next) };
			},
			destroy() {
				node.removeEventListener("pointerenter", enter);
				node.removeEventListener("pointerleave", leave);
				node.removeEventListener("pointerdown", leave);
				node.removeEventListener("focusin", enter);
				node.removeEventListener("focusout", leave);
				leave();
			},
		};
	}

	// ---- collapse (icon rail) ----
	const RAIL_WIDTH = 64;
	let collapsed = $state(false);
	const budgetInitials = $derived(
		currentBudget
			.split(/\s+/)
			.map((w) => w[0])
			.join("")
			.slice(0, 2)
			.toUpperCase(),
	);
	function expandSidebar() {
		collapsed = false;
	}
	const accountInitials = (name: string) => {
		const words = name.trim().split(/\s+/);
		if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
		return name
			.replace(/[^a-z0-9]/gi, "")
			.slice(0, 2)
			.toUpperCase();
	};

	// ---- account hover card ----
	// Prototype detail: synthesize stable, plausible data per account from its name,
	// so hovering a row reveals sync status, balance trend, cleared/uncleared and schedules.
	interface Upcoming {
		date: string;
		payee: string;
		amount: string;
		negative: boolean;
		offset: number; // days from today, for chronological sorting
	}
	interface AccountDetail {
		institution: string;
		type: string;
		points: number[];
		deltaPct: number;
		deltaAbs: number;
		cleared: string;
		unclearedCount: number;
		unclearedAmount: string;
		unclearedNegative: boolean;
		showLedger: boolean;
		upcoming: Upcoming[];
		syncText: string;
	}

	// account name -> its section/group, so we can infer an account "type"
	const accountMeta: Record<string, { section: string; group: string }> = {};
	for (const s of sections)
		for (const g of s.groups)
			for (const a of g.accounts) accountMeta[a.name] = { section: s.label, group: g.label };

	// stable group ids (labels can collide or change)
	let groupIdSeq = 0;
	for (const s of sections) for (const g of s.groups) g.id = `g${groupIdSeq++}`;
	const nextGroupId = () => `g${groupIdSeq++}`;

	const INSTITUTIONS = [
		"Chase",
		"Bank of America",
		"Wells Fargo",
		"Ally",
		"Capital One",
		"Fidelity",
		"Vanguard",
		"Charles Schwab",
		"Amex",
		"Citi",
		"SoFi",
		"US Bank",
	];
	const PAYEES_OUT = ["Netflix", "Spotify", "Electric Co.", "Internet", "Gym", "Insurance", "Phone", "Water"];

	function hashStr(s: string): number {
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}
	function mulberry32(seed: number) {
		return () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	const money = (n: number) =>
		Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	const TODAY = new Date(2026, 6, 16);
	function relTime(mins: number): string {
		if (mins < 60) return `${mins} min ago`;
		const h = Math.round(mins / 60);
		if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
		const d = Math.round(h / 24);
		return `${d} day${d > 1 ? "s" : ""} ago`;
	}
	function typeOf(name: string): string {
		const g = accountMeta[name]?.group ?? "";
		if (g === "Credit Cards") return "Credit Card";
		if (g === "Savings") return "Savings";
		if (g === "Investments") return "Investment";
		if (g === "Loans") return "Loan";
		if (g === "Assets") return "Asset";
		return "Checking";
	}

	const detailCache = new Map<string, AccountDetail>();
	function accountDetail(a: Account): AccountDetail {
		const cached = detailCache.get(a.name);
		if (cached) return cached;
		const rand = mulberry32(hashStr(a.name));
		const value = parseFloat(a.amount.replace(/[^0-9.-]/g, "")) || 0;
		const type = typeOf(a.name);

		// 30-day balance walk that ends exactly at the current value
		const n = 30;
		const deltaFrac = (rand() - 0.45) * 0.16;
		const start = value * (1 - deltaFrac) || (value === 0 ? -1 : value);
		const points: number[] = [];
		for (let i = 0; i < n; i++) {
			const t = i / (n - 1);
			const base = start + (value - start) * t;
			const noise = (rand() - 0.5) * (Math.abs(value) || 100) * 0.045;
			points.push(base + noise);
		}
		points[n - 1] = value;
		const deltaAbs = value - start;
		const deltaPct = start !== 0 ? (deltaAbs / Math.abs(start)) * 100 : 0;

		// cleared / uncleared — only for bank-linked ledger accounts
		const ledgerType = type === "Checking" || type === "Credit Card" || type === "Savings";
		const showLedger = a.status !== "manual" && ledgerType;
		let unclearedCount = 0;
		let unclearedVal = 0;
		if (showLedger) {
			unclearedCount = Math.floor(rand() * (type === "Credit Card" ? 14 : 6));
			if (unclearedCount) {
				const sign = type === "Credit Card" ? -1 : rand() < 0.35 ? -1 : 1;
				unclearedVal = sign * (5 + rand() * 240) * Math.min(unclearedCount, 6);
			}
		}
		const cleared = value - unclearedVal;

		// upcoming scheduled transactions attached to this account
		const upcoming: Upcoming[] = [];
		const addSched = (payee: string, amt: number, dayOffset: number) => {
			const d = new Date(TODAY);
			d.setDate(d.getDate() + dayOffset);
			upcoming.push({
				date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				payee,
				amount: money(amt),
				negative: amt < 0,
				offset: dayOffset,
			});
		};
		if (a.status !== "manual") {
			if (type === "Checking") {
				addSched("Payroll", 2400 + Math.round(rand() * 800), 2 + Math.floor(rand() * 5));
				addSched(
					PAYEES_OUT[Math.floor(rand() * PAYEES_OUT.length)],
					-(20 + Math.round(rand() * 120)),
					4 + Math.floor(rand() * 8),
				);
			} else if (type === "Credit Card") {
				addSched("Minimum Payment", -(35 + Math.round(rand() * 90)), 6 + Math.floor(rand() * 10));
				if (rand() < 0.6)
					addSched(
						PAYEES_OUT[Math.floor(rand() * PAYEES_OUT.length)],
						-(9 + Math.round(rand() * 40)),
						1 + Math.floor(rand() * 5),
					);
			} else if (type === "Loan") {
				addSched("Loan Payment", -(220 + Math.round(rand() * 900)), 3 + Math.floor(rand() * 12));
			} else if (type === "Savings") {
				if (rand() < 0.7) addSched("Transfer In", 100 + Math.round(rand() * 400), 5 + Math.floor(rand() * 14));
			} else if (type === "Investment") {
				if (rand() < 0.5) addSched("Dividend", 12 + Math.round(rand() * 180), 8 + Math.floor(rand() * 18));
			}
		}
		upcoming.sort((x, y) => x.offset - y.offset);

		// sync status line
		const mins = 3 + Math.floor(rand() * 2600);
		let syncText: string;
		if (a.status === "syncing") syncText = "Syncing…";
		else if (a.status === "error") syncText = `Connection error · ${relTime(mins)}`;
		else if (a.status === "manual") syncText = "Manual account · not bank-linked";
		else syncText = `Synced ${relTime(mins)}`;

		const institution =
			a.status === "manual" ? "Manual entry" : INSTITUTIONS[hashStr(a.name) % INSTITUTIONS.length];

		const detail: AccountDetail = {
			institution,
			type,
			points,
			deltaPct,
			deltaAbs,
			cleared: money(cleared),
			unclearedCount,
			unclearedAmount: money(unclearedVal),
			unclearedNegative: unclearedVal < 0,
			showLedger,
			upcoming,
			syncText,
		};
		detailCache.set(a.name, detail);
		return detail;
	}

	function trendPath(pts: number[], w: number, h: number, pad = 3) {
		const min = Math.min(...pts);
		const max = Math.max(...pts);
		const range = max - min || 1;
		const step = w / (pts.length - 1);
		const xy = pts.map((p, i) => [i * step, pad + (h - pad * 2) * (1 - (p - min) / range)] as const);
		const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
		return { line, area: `${line} L ${w} ${h} L 0 ${h} Z` };
	}

	// hover-intent: delay so the card doesn't flash while sweeping the list
	let hoverAccount = $state<Account | null>(null);
	let hoverTop = $state(0);
	let hoverLeft = $state(0);
	let hoverFlip = $state(false);
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	const CARD_WIDTH = 292;
	const HOVER_DELAY = 600; // ms of hover-intent before the card opens
	function showHoverCard(el: HTMLElement, a: Account) {
		const rect = el.getBoundingClientRect();
		const flip = rect.right + CARD_WIDTH + 16 > window.innerWidth;
		hoverFlip = flip;
		hoverLeft = flip ? rect.left - CARD_WIDTH - 10 : rect.right + 10;
		const estH = 360;
		hoverTop = Math.max(12, Math.min(rect.top - 6, window.innerHeight - estH - 12));
		hoverAccount = a;
	}
	function onAccountEnter(e: MouseEvent, a: Account) {
		// don't surface the hover card while dragging, or while the icon picker / a menu is open
		if (dragging || iconAccount || menuAccount || menuGroup) return;
		const el = e.currentTarget as HTMLElement;
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => showHoverCard(el, a), HOVER_DELAY);
	}
	function hideHoverCard() {
		if (hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
		hoverAccount = null;
	}

	// ---- account right-click context menu ----
	let menuAccount = $state<Account | null>(null);
	let menuX = $state(0);
	let menuY = $state(0);
	function openAccountMenu(e: MouseEvent, a: Account) {
		e.preventDefault();
		hideHoverCard();
		// anchor a later icon-picker to the row's leading glyph, not the whole row
		const glyph = (e.currentTarget as HTMLElement).querySelector(".acct-glyph") as HTMLElement | null;
		menuAnchorRect = (glyph ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
		const MW = 200;
		const MH = 250;
		menuX = Math.min(e.clientX, window.innerWidth - MW - 8);
		menuY = Math.min(e.clientY, window.innerHeight - MH - 8);
		menuAccount = a;
	}
	function closeMenus() {
		menuAccount = null;
		menuGroup = null;
	}

	// inline rename (triggered from the context menu)
	let editingAccount = $state<string | null>(null);
	let acctEditValue = $state("");
	function startRename(a: Account) {
		acctEditValue = a.name;
		editingAccount = a.name;
		closeMenus();
	}
	function commitRename(a: Account) {
		const v = acctEditValue.trim();
		if (v && v !== a.name) {
			detailCache.delete(a.name);
			const wasActive = activePage === `account:${a.name}`;
			a.name = v;
			if (wasActive) activePage = `account:${v}`;
		}
		editingAccount = null;
	}
	function onRenameKeydown(e: KeyboardEvent, a: Account) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitRename(a);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			editingAccount = null;
		}
	}
	function toggleBankLink(a: Account) {
		detailCache.delete(a.name);
		a.status = a.status === "manual" ? "synced" : "manual";
		closeMenus();
	}
	function syncNow(a: Account) {
		detailCache.delete(a.name);
		a.status = "syncing";
		closeMenus();
		setTimeout(() => {
			detailCache.delete(a.name);
			a.status = "synced";
		}, 1500);
	}
	function reconcile(_a: Account) {
		// Placeholder: the real app opens a reconcile dialog to enter the true balance.
		closeMenus();
	}
	function closeAccount(a: Account) {
		for (const s of sections) {
			for (const g of s.groups) {
				const i = g.accounts.indexOf(a);
				if (i !== -1) {
					g.accounts.splice(i, 1);
					const closed = sections.find((x) => x.label === "Closed");
					if (closed) {
						if (!closed.groups.length) closed.groups.push({ label: "", accounts: [] });
						closed.groups[0].accounts.push(a);
					}
					if (activePage === `account:${a.name}`) activePage = "Budget";
					closeMenus();
					return;
				}
			}
		}
	}

	// ---- drag reorder ----
	// Accounts reorder anywhere within their section (incl. across sub-categories),
	// never across sections. Sub-category headers reorder within their section.
	type DragKind = "account" | "group";
	let dragKind: DragKind | null = null;
	let dragAccount: Account | null = null;
	let dragGroup: Group | null = null;
	let dragSrcId = $state<string | null>(null);
	let overId = $state<string | null>(null);
	let overPos = $state<"before" | "after">("before");
	let dragging = $state(false);

	function locateAccount(a: Account) {
		for (const s of sections)
			for (const g of s.groups) {
				const i = g.accounts.indexOf(a);
				if (i !== -1) return { section: s, group: g, index: i };
			}
		return null;
	}
	function locateGroup(g: Group) {
		for (const s of sections) {
			const i = s.groups.indexOf(g);
			if (i !== -1) return { section: s, index: i };
		}
		return null;
	}
	function edgePos(e: DragEvent, el: HTMLElement): "before" | "after" {
		const r = el.getBoundingClientRect();
		return e.clientY < r.top + r.height / 2 ? "before" : "after";
	}
	function endDrag() {
		dragKind = null;
		dragAccount = null;
		dragGroup = null;
		dragSrcId = null;
		dragging = false;
		overId = null;
	}

	function onAccountDragStart(e: DragEvent, a: Account) {
		dragKind = "account";
		dragAccount = a;
		dragSrcId = `acct:${a.name}`;
		dragging = true;
		hideHoverCard();
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", a.name);
		}
	}
	function onAccountDragOver(e: DragEvent, target: Account) {
		if (dragKind !== "account" || !dragAccount) return;
		if (target === dragAccount) {
			overId = null;
			return;
		}
		const src = locateAccount(dragAccount);
		const tgt = locateAccount(target);
		if (!src || !tgt || src.section !== tgt.section) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		overId = `acct:${target.name}`;
		overPos = edgePos(e, e.currentTarget as HTMLElement);
	}
	function onAccountDrop(e: DragEvent, target: Account) {
		if (dragKind !== "account" || !dragAccount) return;
		e.preventDefault();
		moveAccount(dragAccount, target, edgePos(e, e.currentTarget as HTMLElement));
		endDrag();
	}
	function moveAccount(src: Account, target: Account, pos: "before" | "after") {
		if (src === target) return;
		const s = locateAccount(src);
		const t = locateAccount(target);
		if (!s || !t || s.section !== t.section) return;
		s.group.accounts.splice(s.index, 1);
		let ti = t.group.accounts.indexOf(target);
		if (pos === "after") ti += 1;
		t.group.accounts.splice(ti, 0, src);
		detailCache.delete(src.name);
		accountMeta[src.name] = { section: t.section.label, group: t.group.label };
	}

	function onGroupDragStart(e: DragEvent, g: Group) {
		dragKind = "group";
		dragGroup = g;
		dragSrcId = `grp:${g.id}`;
		dragging = true;
		hideHoverCard();
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", g.label);
		}
	}
	function onGroupHeaderDragOver(e: DragEvent, g: Group) {
		if (dragKind === "account" && dragAccount) {
			// dropping an account onto a header moves it to the top of that group
			const src = locateAccount(dragAccount);
			const tl = locateGroup(g);
			if (!src || !tl || src.section !== tl.section) return;
			e.preventDefault();
			overId = `grp:${g.id}`;
			overPos = "before";
		} else if (dragKind === "group" && dragGroup && dragGroup !== g) {
			const s = locateGroup(dragGroup);
			const t = locateGroup(g);
			if (!s || !t || s.section !== t.section) return;
			e.preventDefault();
			overId = `grp:${g.id}`;
			overPos = edgePos(e, e.currentTarget as HTMLElement);
		}
	}
	function onGroupHeaderDrop(e: DragEvent, g: Group) {
		if (dragKind === "account" && dragAccount) {
			e.preventDefault();
			const src = locateAccount(dragAccount);
			const tl = locateGroup(g);
			if (src && tl && src.section === tl.section) {
				src.group.accounts.splice(src.index, 1);
				g.accounts.unshift(dragAccount);
				detailCache.delete(dragAccount.name);
				accountMeta[dragAccount.name] = { section: tl.section.label, group: g.label };
			}
		} else if (dragKind === "group" && dragGroup) {
			e.preventDefault();
			moveGroup(dragGroup, g, edgePos(e, e.currentTarget as HTMLElement));
		}
		endDrag();
	}
	function moveGroup(src: Group, target: Group, pos: "before" | "after") {
		if (src === target) return;
		const s = locateGroup(src);
		const t = locateGroup(target);
		if (!s || !t || s.section !== t.section) return;
		s.section.groups.splice(s.index, 1);
		let ti = t.section.groups.indexOf(target);
		if (pos === "after") ti += 1;
		t.section.groups.splice(ti, 0, src);
	}

	// ---- category (sub-group) CRUD ----
	let editingGroup = $state<string | null>(null); // group id being renamed
	let groupEditValue = $state("");
	let menuGroup = $state<Group | null>(null);

	function addCategory(s: Section) {
		if (!groupAccounts) groupAccounts = true; // categories only make sense in grouped view
		const g: Group = { id: nextGroupId(), label: "New Category", accounts: [] };
		s.groups.push(g);
		collapsedGroups[g.id!] = false;
		startGroupRename(g);
	}
	function startGroupRename(g: Group) {
		groupEditValue = g.label;
		editingGroup = g.id ?? null;
		closeMenus();
	}
	function commitGroupRename(g: Group) {
		const v = groupEditValue.trim();
		if (v) g.label = v;
		editingGroup = null;
	}
	function onGroupRenameKeydown(e: KeyboardEvent, g: Group) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitGroupRename(g);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			editingGroup = null;
		}
	}
	function openGroupMenu(e: MouseEvent, g: Group) {
		e.preventDefault();
		e.stopPropagation();
		hideHoverCard();
		menuAccount = null;
		const MW = 200;
		const MH = 110;
		menuX = Math.min(e.clientX, window.innerWidth - MW - 8);
		menuY = Math.min(e.clientY, window.innerHeight - MH - 8);
		menuGroup = g;
	}
	// remove a category by ungrouping: its accounts move to the section's
	// uncategorized bucket (created if needed), then the empty header is dropped.
	function removeCategory(g: Group) {
		const loc = locateGroup(g);
		closeMenus();
		if (!loc) return;
		const { section } = loc;
		if (g.accounts.length) {
			let bucket = section.groups.find((x) => x.label === "");
			if (!bucket) {
				bucket = { id: nextGroupId(), label: "", accounts: [] };
				section.groups.unshift(bucket);
			}
			for (const a of g.accounts) accountMeta[a.name] = { section: section.label, group: "" };
			bucket.accounts.push(...g.accounts);
		}
		const i = section.groups.indexOf(g);
		if (i !== -1) section.groups.splice(i, 1);
	}

	// ---- account icon picker (Emoji / Logo / Upload) — ported from ABT ----
	interface EmojiEntry {
		emoji: string;
		name: string;
		slug: string;
		skin_tone_support: boolean;
	}
	interface EmojiGroup {
		name: string;
		emojis: EmojiEntry[];
	}
	const emojiGroups = emojiData as unknown as EmojiGroup[];
	const EMOJI_GROUP_ICONS: Record<string, string> = {
		"Smileys & Emotion": "😀",
		"People & Body": "🧑",
		"Animals & Nature": "🐶",
		"Food & Drink": "🍕",
		"Travel & Places": "✈️",
		Activities: "⚽",
		Objects: "💡",
		Symbols: "💱",
		Flags: "🏳️",
	};
	const FAVICON_BASE =
		"https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://";
	function faviconUrl(input: string, size = 128): string | null {
		try {
			const domain = input.includes("://") ? new URL(input).hostname : input.replace(/^www\./, "");
			return domain ? `${FAVICON_BASE}${domain}&size=${size}` : null;
		} catch {
			return null;
		}
	}

	type IconTab = "emoji" | "logo" | "upload";
	let iconAccount = $state<Account | null>(null);
	let iconX = $state(0);
	let iconY = $state(0);
	let iconTab = $state<IconTab>("emoji");
	let iconPickerEl = $state<HTMLElement | null>(null);
	let menuAnchorRect: DOMRect | null = null;

	// emoji tab
	let emojiSearch = $state("");
	let emojiActiveGroup = $state(emojiGroups[0]?.name ?? "");
	let emojiGridWrap = $state<HTMLElement | null>(null);
	const filteredEmoji = $derived.by(() => {
		const q = emojiSearch.trim().toLowerCase();
		if (!q) return null;
		const out: EmojiEntry[] = [];
		for (const g of emojiGroups)
			for (const e of g.emojis) {
				if (e.name.includes(q) || e.slug.includes(q)) out.push(e);
				if (out.length >= 80) return out;
			}
		return out;
	});
	function scrollToEmojiGroup(name: string) {
		emojiActiveGroup = name;
		emojiSearch = "";
		emojiGridWrap?.querySelector(`[data-egroup="${name}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
	}

	// logo tab
	let logoDomain = $state("");
	let logoUrl = $state<string | null>(null);
	let logoLoaded = $state(false);
	let logoError = $state(false);
	let logoDebounce: ReturnType<typeof setTimeout> | null = null;
	function fetchLogo() {
		logoUrl = faviconUrl(logoDomain.trim().toLowerCase());
		logoLoaded = false;
		logoError = false;
	}
	function onLogoInput() {
		if (logoDebounce) clearTimeout(logoDebounce);
		logoDebounce = setTimeout(fetchLogo, 400);
	}

	// upload tab
	let uploadDataUrl = $state<string | null>(null);
	let uploadDragOver = $state(false);
	let uploadInputEl = $state<HTMLInputElement | null>(null);
	function readImageFile(file: File) {
		if (!file.type.startsWith("image/")) return;
		const reader = new FileReader();
		reader.onload = (e) => (uploadDataUrl = e.target?.result as string);
		reader.readAsDataURL(file);
	}

	const IP_W = 280;
	const IP_H = 372;
	// `rect` is the account's leading-glyph rect, so the picker opens right by the icon.
	function openIconPicker(rect: DOMRect, a: Account) {
		closeMenus();
		hideHoverCard();
		const m = 8;
		// left-align with the icon, drop it just below; flip above if there's no room
		let left = Math.min(rect.left - 4, window.innerWidth - IP_W - m);
		iconX = Math.max(m, left);
		let top = rect.bottom + 6;
		if (top + IP_H > window.innerHeight - m) top = rect.top - IP_H - 6;
		iconY = Math.max(m, top);
		iconTab = "emoji";
		emojiSearch = "";
		logoDomain = "";
		logoUrl = null;
		uploadDataUrl = null;
		iconAccount = a;
	}
	function closeIconPicker() {
		iconAccount = null;
	}
	function chooseIcon(icon: AccountIcon) {
		if (iconAccount) iconAccount.icon = icon;
		closeIconPicker();
	}
	function removeIcon(a: Account) {
		a.icon = undefined;
		closeIconPicker();
		closeMenus();
	}

	// ---- resize ----
	const MIN_WIDTH = 240;
	const MAX_WIDTH = 560;
	const DEFAULT_WIDTH = 325;
	let sidebarWidth = $state(DEFAULT_WIDTH);
	let resizing = $state(false);
	let dragStartX = 0;
	let dragStartWidth = 0;

	function startResize(e: PointerEvent) {
		resizing = true;
		dragStartX = e.clientX;
		dragStartWidth = sidebarWidth;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* synthetic events may lack a capturable pointer id */
		}
	}
	function onResizeMove(e: PointerEvent) {
		if (!resizing) return;
		const next = dragStartWidth + (e.clientX - dragStartX);
		sidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
	}
	function endResize(e: PointerEvent) {
		if (!resizing) return;
		resizing = false;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
	}
	function resetWidth() {
		sidebarWidth = DEFAULT_WIDTH;
	}

	// The sidebar list no longer filters by text — search opens the command
	// palette instead. `q` stays so the force-expand / match plumbing keeps
	// working (and could host a future inline filter again).
	const q = "";

	const accountMatches = (a: Account) => q === "" || a.name.toLowerCase().includes(q);
	const visibleAccounts = (g: Group) => (q === "" ? g.accounts : g.accounts.filter(accountMatches));
	const groupHasMatches = (g: Group) => visibleAccounts(g).length > 0;
	const sectionHasMatches = (s: Section) => q === "" || s.groups.some(groupHasMatches);
	const sectionHasAccounts = (s: Section) => s.groups.some((g) => g.accounts.length > 0);
	const sectionCount = (s: Section) => s.groups.reduce((n, g) => n + g.accounts.length, 0);
	// Flat mode: every visible account in a section, ignoring its sub-category grouping.
	const sectionAccounts = (s: Section) => s.groups.flatMap(visibleAccounts);

	// While searching, everything is force-expanded so matches are always visible.
	const sectionOpen = (s: Section) => q !== "" || !collapsedSections[s.label];
	const groupOpen = (g: Group) => q !== "" || !collapsedGroups[g.id ?? g.label];

	function toggleSection(s: Section) {
		if (sectionHasAccounts(s)) collapsedSections[s.label] = !collapsedSections[s.label];
	}
	function toggleGroup(g: Group) {
		const k = g.id ?? g.label;
		collapsedGroups[k] = !collapsedGroups[k];
	}

	// show a named group even when empty (so freshly-created categories appear);
	// while searching, only show groups with matches
	const showGroup = (g: Group) => (g.label ? q === "" || groupHasMatches(g) : groupHasMatches(g));

	// ---- command palette (⌘K) ----
	// The sidebar search box is a launcher only: it opens this centered
	// quick-switcher (VS Code style) that unifies accounts, navigation and
	// quick actions. Design mock — rows navigate, quick actions are inert.
	interface QuickAction {
		icon: string;
		label: string;
		hint?: string; // right-aligned keyboard hint
	}
	const QUICK_ACTIONS: QuickAction[] = [
		{ icon: "plus", label: "Add new transaction", hint: "T" },
		{ icon: "schedule", label: "Create new schedule" },
		{ icon: "report", label: "Create new report" },
		{ icon: "sync", label: "Sync all accounts", hint: "⇧S" },
		{ icon: "import", label: "Import transactions…" },
		{ icon: "bank", label: "Add new account" },
		{ icon: "reconcile", label: "Reconcile account…" },
	];
	const NAV_PAGES = [...navItems, ...moreItems];

	type PaletteItem =
		| { kind: "action"; action: QuickAction }
		| { kind: "nav"; page: string }
		| { kind: "account"; account: Account };
	interface PaletteGroup {
		label: string;
		items: PaletteItem[];
	}

	let paletteOpen = $state(false);
	let paletteQuery = $state("");
	let paletteIndex = $state(0); // index into the flattened item list
	let paletteListEl = $state<HTMLElement | null>(null);

	const pq = $derived(paletteQuery.trim().toLowerCase());
	const allAccounts = $derived(sections.flatMap((s) => s.groups.flatMap((g) => g.accounts)));
	const paletteGroups = $derived.by(() => {
		const match = (s: string) => pq === "" || s.toLowerCase().includes(pq);
		const accounts = allAccounts.filter((a) => match(a.name));
		const groups: PaletteGroup[] = [
			{
				// resting state previews a handful; typing searches all of them
				label: "Accounts",
				items: (pq === "" ? accounts.slice(0, 5) : accounts).map((account) => ({
					kind: "account" as const,
					account,
				})),
			},
			{
				label: "Go to",
				items: NAV_PAGES.filter(match).map((page) => ({ kind: "nav" as const, page })),
			},
			{
				label: "Quick actions",
				items: QUICK_ACTIONS.filter((a) => match(a.label)).map((action) => ({
					kind: "action" as const,
					action,
				})),
			},
		];
		return groups.filter((g) => g.items.length > 0);
	});
	const paletteItems = $derived(paletteGroups.flatMap((g) => g.items));
	// global index of a group's first item, so rows can compare against paletteIndex
	const paletteGroupBase = (gi: number) => paletteGroups.slice(0, gi).reduce((n, g) => n + g.items.length, 0);

	function openPalette() {
		closeBudget();
		closeMenus();
		closeIconPicker();
		hideHoverCard();
		paletteQuery = "";
		paletteIndex = 0;
		paletteOpen = true;
	}
	function closePalette() {
		paletteOpen = false;
	}
	function runPaletteItem(item: PaletteItem) {
		// Mock behavior: navigation rows navigate, quick actions just dismiss.
		if (item.kind === "nav") activePage = item.page;
		else if (item.kind === "account") activePage = `account:${item.account.name}`;
		closePalette();
	}
	function movePaletteIndex(delta: number) {
		const n = paletteItems.length;
		if (!n) return;
		paletteIndex = (paletteIndex + delta + n) % n;
		paletteListEl?.querySelector(`[data-pidx="${paletteIndex}"]`)?.scrollIntoView({ block: "nearest" });
	}
	function onPaletteKeydown(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			movePaletteIndex(1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			movePaletteIndex(-1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const item = paletteItems[paletteIndex];
			if (item) runPaletteItem(item);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
			e.preventDefault();
			paletteOpen ? closePalette() : openPalette();
		} else if (e.key === "Escape" && paletteOpen) {
			closePalette();
		} else if (e.key === "Escape" && iconAccount) {
			closeIconPicker();
		} else if (e.key === "Escape" && (menuAccount || menuGroup)) {
			closeMenus();
		} else if (e.key === "Escape" && budgetOpen) {
			closeBudget();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleWindowClick} />

{#snippet caret(open: boolean)}
	<ChevronDown class={open ? "caret" : "caret collapsed"} color="var(--sb-fgm-a50)" strokeWidth={3} />
{/snippet}

{#snippet budgetStateIcon(state: BudgetState)}
	{#if state === "syncing"}
		<CloudCheck strokeWidth={1.5} />
	{:else if state === "downloadable"}
		<CloudDownload strokeWidth={1.5} />
	{:else}
		<CloudOff strokeWidth={1.5} />
	{/if}
{/snippet}

{#snippet groupToggleIcon(grouped: boolean)}
	{#if grouped}
		<!-- indented rows = grouped by sub-category -->
		<ListTree strokeWidth={1.5} />
	{:else}
		<!-- even rows = flat list -->
		<List strokeWidth={1.5} />
	{/if}
{/snippet}

{#snippet navIcon(name: string)}
	{#if name === "Budget"}
		<LayoutGrid strokeWidth={1.5} />
	{:else if name === "Reports"}
		<ChartColumn strokeWidth={1.5} />
	{:else if name === "Schedules"}
		<Calendar strokeWidth={1.5} />
	{:else if name === "More"}
		<Ellipsis strokeWidth={1.5} />
	{:else if name === "Payees"}
		<Users strokeWidth={1.5} />
	{:else if name === "Rules"}
		<SlidersHorizontal strokeWidth={1.5} />
	{:else if name === "Bank Sync"}
		<Landmark strokeWidth={1.5} />
	{:else if name === "Tags"}
		<Tag strokeWidth={1.5} />
	{:else if name === "Settings"}
		<Settings strokeWidth={1.5} />
	{/if}
{/snippet}

{#snippet statusIcon(status: Status)}
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
{/snippet}

<!-- account icon (avatar): sits to the left of the name, separate from the status dot -->
{#snippet acctIcon(a: Account)}
	{#if a.icon}
		<span class="acct-icon">
			{#if a.icon.type === "emoji"}
				<span class="acct-icon-emoji">{a.icon.value}</span>
			{:else}
				<img class="acct-icon-img" src={a.icon.value} alt="" />
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet ctxIcon(name: string)}
	{#if name === "rename"}
		<Pencil strokeWidth={1.5} />
	{:else if name === "sync"}
		<RefreshCw strokeWidth={1.5} />
	{:else if name === "reconcile"}
		<Scale strokeWidth={1.5} />
	{:else if name === "link"}
		<Link strokeWidth={1.5} />
	{:else if name === "emoji"}
		<Smile strokeWidth={1.5} />
	{:else if name === "unlink"}
		<Unlink strokeWidth={1.5} />
	{:else if name === "close"}
		<Archive strokeWidth={1.5} />
	{:else if name === "ungroup"}
		<Ungroup strokeWidth={1.5} />
	{:else if name === "plus"}
		<Plus strokeWidth={1.5} />
	{/if}
{/snippet}

<!-- command palette: quick-action icons -->
{#snippet cpActionIcon(name: string)}
	{#if name === "plus"}
		<Plus strokeWidth={1.5} />
	{:else if name === "schedule"}
		<Calendar strokeWidth={1.5} />
	{:else if name === "report"}
		<ChartColumn strokeWidth={1.5} />
	{:else if name === "sync"}
		<RefreshCw strokeWidth={1.5} />
	{:else if name === "import"}
		<Download strokeWidth={1.5} />
	{:else if name === "bank"}
		<Landmark strokeWidth={1.5} />
	{:else if name === "reconcile"}
		<Scale strokeWidth={1.5} />
	{/if}
{/snippet}

<!-- command palette: bold the part of a label that matches the query -->
{#snippet hl(text: string)}
	{@const i = pq === "" ? -1 : text.toLowerCase().indexOf(pq)}
	{#if i === -1}{text}{:else}{text.slice(0, i)}<mark class="cp-mark">{text.slice(i, i + pq.length)}</mark>{text.slice(
			i + pq.length,
		)}{/if}
{/snippet}

{#snippet accountRow(a: Account)}
	{@const key = `account:${a.name}`}
	{@const isSelected = activePage === key}
	{@const rowId = `acct:${a.name}`}
	{#if editingAccount === a.name}
		<div class="account editing">
			{@render statusIcon(a.status)}
			{@render acctIcon(a)}
			<input
				class="account-rename"
				bind:value={acctEditValue}
				use:autofocus
				onkeydown={(e) => onRenameKeydown(e, a)}
				onblur={() => commitRename(a)}
			/>
		</div>
	{:else}
		<button
			type="button"
			class="account"
			class:selected={isSelected}
			class:dragging={dragSrcId === rowId}
			class:drop-before={overId === rowId && overPos === "before"}
			class:drop-after={overId === rowId && overPos === "after"}
			draggable="true"
			onclick={() => (activePage = key)}
			oncontextmenu={(e) => openAccountMenu(e, a)}
			onmouseenter={(e) => onAccountEnter(e, a)}
			onmouseleave={hideHoverCard}
			ondragstart={(e) => onAccountDragStart(e, a)}
			ondragover={(e) => onAccountDragOver(e, a)}
			ondrop={(e) => onAccountDrop(e, a)}
			ondragend={endDrag}
		>
			<span
				class="acct-glyph"
				class:has-icon={!!a.icon}
				role="button"
				tabindex="-1"
				aria-label="Change icon"
				use:tooltip={{ text: "Change icon", placement: "right" }}
				onclick={(e) => {
					e.stopPropagation();
					openIconPicker((e.currentTarget as HTMLElement).getBoundingClientRect(), a);
				}}
				onkeydown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						e.stopPropagation();
						openIconPicker((e.currentTarget as HTMLElement).getBoundingClientRect(), a);
					}
				}}
			>
				{@render statusIcon(a.status)}
				{@render acctIcon(a)}
				<span class="acct-glyph-edit" aria-hidden="true">{@render ctxIcon("emoji")}</span>
			</span>
			<span class="account-name" class:mauve={isSelected}>{a.name}</span>
			{#if a.uncategorized}
				<span
					class="account-uncat"
					aria-label={`${a.uncategorized} uncategorized transaction${a.uncategorized === 1 ? "" : "s"}`}
					use:tooltip={{
						text: `${a.uncategorized} uncategorized transaction${a.uncategorized === 1 ? "" : "s"}`,
						placement: "top",
					}}>{a.uncategorized}</span
				>
			{/if}
			<span class="account-amount" class:mauve={isSelected} class:red={!isSelected && a.negative}>{a.amount}</span
			>
		</button>
	{/if}
{/snippet}

<div
	class="sidebar"
	class:resizing
	class:collapsed
	class:light={theme === "light"}
	style="width: {collapsed ? RAIL_WIDTH : sidebarWidth}px"
>
	{#if collapsed}
		<!-- ===== Collapsed icon rail ===== -->
		<button
			type="button"
			class="rail-avatar"
			onclick={expandSidebar}
			aria-label={`${currentBudget} — expand`}
			use:tooltip={`${currentBudget} — expand`}>{budgetInitials}</button
		>
		<button type="button" class="rail-icon" onclick={openPalette} aria-label="Search" use:tooltip={"Search (⌘K)"}>
			<Search />
		</button>
		<div class="rail-nav">
			{#each navItems as item}
				<button
					type="button"
					class="rail-icon"
					class:active={activePage === item}
					onclick={() => (activePage = item)}
					aria-label={item}
					use:tooltip={item}
				>
					{@render navIcon(item)}
				</button>
			{/each}
			<button type="button" class="rail-icon" onclick={expandSidebar} aria-label="More" use:tooltip={"More"}>
				{@render navIcon("More")}
			</button>
		</div>
		<div class="rail-divider"></div>
		<div class="rail-list">
			{#each sections as section}
				{#if sectionHasAccounts(section)}
					{@const [first, ...rest] = section.label.split(" ")}
					<div class="rail-section" use:tooltip={`${section.label} · ${section.total}`}>
						{first}{#if rest.length}<small>{rest.join(" ")}</small>{/if}
					</div>
					{#each section.groups as group, gi}
						{#if gi > 0 && group.accounts.length}<div class="rail-gsep"></div>{/if}
						{#each group.accounts as a (a.name)}
							{@const key = `account:${a.name}`}
							<button
								type="button"
								class="rtile-wrap"
								class:selected={activePage === key}
								aria-label={`${a.name} · ${a.amount}`}
								use:tooltip={`${a.name} · ${a.amount}`}
								onclick={() => (activePage = key)}
							>
								<span class="rtile">
									{#if a.icon}
										{#if a.icon.type === "emoji"}<span class="rtile-emoji">{a.icon.value}</span
											>{:else}<img class="rtile-img" src={a.icon.value} alt="" />{/if}
									{:else}{accountInitials(a.name)}{/if}
								</span>
								<span class="rtile-badge">{@render statusIcon(a.status)}</span>
							</button>
						{/each}
					{/each}
				{/if}
			{/each}
		</div>
		<div class="rail-foot">
			<button type="button" class="rail-icon" aria-label="Add account" use:tooltip={"Add account"}>
				<Plus strokeWidth={2.2} />
			</button>
			<button
				type="button"
				class="rail-icon"
				onclick={expandSidebar}
				aria-label="Expand sidebar"
				use:tooltip={"Expand sidebar"}
			>
				<PanelLeftOpen />
			</button>
		</div>
	{:else}
		<!-- Budget selection -->
		<div class="budget" bind:this={budgetEl}>
			{#if !budgetOpen}
				<button
					type="button"
					class="budget-select"
					onclick={(e) => {
						e.stopPropagation();
						budgetOpen = true;
					}}
				>
					<span class="budget-name">{currentBudget}</span>
					<ChevronsUpDown class="chevron-updown" />
				</button>
			{:else}
				<div class="budget-header" class:editing={editingBudget}>
					{#if editingBudget}
						<input
							class="budget-edit"
							bind:value={editValue}
							use:autofocus
							onkeydown={onEditKeydown}
							onblur={commitEdit}
						/>
					{:else}
						<button
							type="button"
							class="budget-name-btn"
							onclick={(e) => {
								e.stopPropagation();
								budgetOpen = false;
							}}
						>
							<span class="budget-name">{currentBudget}</span>
						</button>
					{/if}
					<button
						type="button"
						class="budget-edit-btn"
						aria-label={editingBudget ? "Save budget name" : "Rename budget"}
						onclick={(e) => {
							e.stopPropagation();
							editingBudget ? commitEdit() : startEdit();
						}}
					>
						{#if editingBudget}
							<Check strokeWidth={2.4} />
						{:else}
							<Pencil />
						{/if}
					</button>
				</div>
				<div class="budget-menu">
					{#each budgets as b (b.name)}
						{@const isActive = b.name === currentBudget}
						<button
							type="button"
							class="budget-item"
							class:active={isActive}
							onclick={() => selectBudget(b)}
						>
							<span class="budget-dot" class:active={isActive}></span>
							<span class="budget-item-name">{b.name}</span>
							<span
								class="budget-state budget-state-{b.state}"
								aria-label={budgetStateLabel(b.state)}
								use:tooltip={{ text: budgetStateLabel(b.state), placement: "left" }}
							>
								{@render budgetStateIcon(b.state)}
							</span>
						</button>
					{/each}
					<div class="budget-menu-divider"></div>
					<button type="button" class="budget-exit" onclick={closeFile}>
						<LogOut />
						<span>Close file</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- Search: a launcher, not a filter — opens the command palette -->
		<button type="button" class="search" onclick={openPalette}>
			<span class="search-left">
				<Search class="search-icon" color="var(--sb-fg-muted)" strokeWidth={1.75} />
				<span class="search-placeholder">Search...</span>
			</span>
			<span class="search-kbd">⌘K</span>
		</button>

		<!-- Nav -->
		<nav class="nav">
			{#each navItems as item}
				<button
					type="button"
					class="nav-link"
					class:active={activePage === item}
					onclick={() => (activePage = item)}
				>
					<span class="nav-icon">{@render navIcon(item)}</span>
					<span class="nav-label">{item}</span>
				</button>
			{/each}

			<!-- More: pure disclosure for its sub-pages (not a page itself) -->
			<button
				type="button"
				class="nav-link"
				aria-expanded={moreExpanded}
				onclick={() => (moreExpanded = !moreExpanded)}
			>
				<span class="nav-icon">{@render navIcon("More")}</span>
				<span class="nav-label">More</span>
				<span class="nav-caret">{@render caret(moreExpanded)}</span>
			</button>

			{#if moreExpanded}
				<div class="nav-sublist">
					{#each moreItems as sub}
						<button
							type="button"
							class="nav-link nav-sublink"
							class:active={activePage === sub}
							onclick={() => (activePage = sub)}
						>
							<span class="nav-icon">{@render navIcon(sub)}</span>
							<span class="nav-label">{sub}</span>
						</button>
					{/each}
				</div>
			{/if}
		</nav>

		<div class="divider"></div>

		<!-- Accounts -->
		<div
			class="accounts"
			bind:this={accountsEl}
			style:mask-image={accountsMask}
			style:-webkit-mask-image={accountsMask}
			onscroll={handleAccountsScroll}
		>
			<div class="all-accounts section-head" class:active={activePage === "All Accounts"}>
				<button type="button" class="section-nav" onclick={() => (activePage = "All Accounts")}>
					<span class="group-label">All Accounts</span>
					<span class="group-total">{grandTotal}</span>
				</button>
				<button
					type="button"
					class="group-toggle"
					class:on={groupAccounts}
					aria-pressed={groupAccounts}
					use:tooltip={{
						text: groupAccounts
							? "Grouped by category — click for a flat list"
							: "Flat list — click to group by category",
						placement: "right",
					}}
					onclick={() => (groupAccounts = !groupAccounts)}
				>
					{@render groupToggleIcon(groupAccounts)}
				</button>
			</div>

			{#each sections as section}
				{#if sectionHasMatches(section)}
					<div class="section">
						<div class="group-header section-head" class:active={activePage === section.label}>
							<button
								type="button"
								class="caret-btn"
								class:disabled={!sectionHasAccounts(section)}
								aria-label={sectionOpen(section) ? "Collapse section" : "Expand section"}
								aria-expanded={sectionOpen(section)}
								onclick={() => toggleSection(section)}
							>
								{@render caret(sectionOpen(section))}
							</button>
							<button type="button" class="section-nav" onclick={() => (activePage = section.label)}>
								<span class="group-label" class:dim={section.muted}>{section.label}</span>
								{#if sectionCount(section)}<span class="group-count">{sectionCount(section)}</span>{/if}
								<span class="group-total">{section.total}</span>
							</button>
							{#if !section.muted}
								<button
									type="button"
									class="section-add"
									aria-label="New category in {section.label}"
									use:tooltip={{ text: "New category", placement: "top" }}
									onclick={(e) => {
										e.stopPropagation();
										addCategory(section);
									}}
								>
									{@render ctxIcon("plus")}
								</button>
							{/if}
						</div>

						{#if sectionOpen(section)}
							{#if groupAccounts}
								{#each section.groups as group (group.id)}
									{#if showGroup(group)}
										{#if group.label}
											{#if editingGroup === group.id}
												<div class="group-header sub editing-group">
													{@render caret(true)}
													<input
														class="group-rename"
														bind:value={groupEditValue}
														use:autofocus
														onkeydown={(e) => onGroupRenameKeydown(e, group)}
														onblur={() => commitGroupRename(group)}
													/>
												</div>
											{:else}
												<button
													type="button"
													class="group-header sub toggleable"
													class:dragging={dragSrcId === `grp:${group.id}`}
													class:drop-before={overId === `grp:${group.id}` &&
														overPos === "before"}
													class:drop-after={overId === `grp:${group.id}` &&
														overPos === "after"}
													draggable="true"
													onclick={() => toggleGroup(group)}
													ondblclick={() => startGroupRename(group)}
													oncontextmenu={(e) => openGroupMenu(e, group)}
													ondragstart={(e) => onGroupDragStart(e, group)}
													ondragover={(e) => onGroupHeaderDragOver(e, group)}
													ondrop={(e) => onGroupHeaderDrop(e, group)}
													ondragend={endDrag}
												>
													{@render caret(groupOpen(group))}
													<span class="group-label sub-label">{group.label}</span>
													{#if group.accounts.length}<span class="group-count sub-count"
															>{group.accounts.length}</span
														>{/if}
													{#if group.total}<span class="group-total">{group.total}</span>{/if}
												</button>
											{/if}
											{#if groupOpen(group)}
												{#if visibleAccounts(group).length}
													<div class="account-list indented">
														{#each visibleAccounts(group) as a (a.name)}{@render accountRow(
																a,
															)}{/each}
													</div>
												{:else if q === ""}
													<div
														class="group-empty-hint"
														class:drop-before={overId === `grp:${group.id}`}
														ondragover={(e) => onGroupHeaderDragOver(e, group)}
														ondrop={(e) => onGroupHeaderDrop(e, group)}
														role="list"
													>
														Drop accounts here
													</div>
												{/if}
											{/if}
										{:else}
											<div class="account-list">
												{#each visibleAccounts(group) as a (a.name)}{@render accountRow(
														a,
													)}{/each}
											</div>
										{/if}
									{/if}
								{/each}
							{:else}
								<!-- flat: all accounts in the section, no sub-category headers or indent -->
								<div class="account-list">
									{#each sectionAccounts(section) as a (a.name)}{@render accountRow(a)}{/each}
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			{/each}
		</div>

		<!-- Footer -->
		<div class="footer">
			<button type="button" class="add-account">
				<Plus class="plus" strokeWidth={2.2} />
				<span>Add account</span>
			</button>
			<button
				type="button"
				class="theme-toggle"
				aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
				use:tooltip={{
					text: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
					placement: "top",
				}}
				onclick={toggleTheme}
			>
				{#if theme === "dark"}
					<!-- sun: click to go light -->
					<Sun />
				{:else}
					<!-- moon: click to go dark -->
					<Moon />
				{/if}
			</button>
			<button
				type="button"
				class="collapse"
				aria-label="Collapse sidebar"
				use:tooltip={{ text: "Collapse sidebar", placement: "top" }}
				onclick={() => (collapsed = true)}
			>
				<PanelLeftClose />
			</button>
		</div>
	{/if}

	<!-- Custom tooltip (replaces native title=) -->
	{#if tip}
		<div class="tooltip tip-{tip.placement}" style="left: {tip.x}px; top: {tip.y}px" role="tooltip">
			{tip.text}
		</div>
	{/if}

	<!-- Command palette (⌘K): centered quick-switcher over the whole app -->
	{#if paletteOpen}
		<div class="cp-backdrop" onclick={closePalette} aria-hidden="true"></div>
		<div class="cp" role="dialog" aria-modal="true" aria-label="Command palette">
			<div class="cp-search">
				<Search class="cp-search-icon" />
				<input
					class="cp-input"
					type="text"
					placeholder="Search accounts, pages and actions…"
					bind:value={paletteQuery}
					use:autofocus
					oninput={() => (paletteIndex = 0)}
					onkeydown={onPaletteKeydown}
				/>
				<span class="cp-kbd">esc</span>
			</div>
			<div class="cp-body" bind:this={paletteListEl}>
				{#each paletteGroups as group, gi (group.label)}
					{@const base = paletteGroupBase(gi)}
					<div class="cp-group-label">{group.label}</div>
					{#each group.items as item, ii}
						{@const idx = base + ii}
						<button
							type="button"
							class="cp-item"
							class:selected={idx === paletteIndex}
							data-pidx={idx}
							onmousemove={() => (paletteIndex = idx)}
							onclick={() => runPaletteItem(item)}
						>
							{#if item.kind === "account"}
								<span class="cp-item-glyph">
									{@render statusIcon(item.account.status)}
									{@render acctIcon(item.account)}
								</span>
								<span class="cp-item-label">{@render hl(item.account.name)}</span>
								<span class="cp-item-amount" class:red={item.account.negative}
									>{item.account.amount}</span
								>
							{:else if item.kind === "nav"}
								<span class="cp-item-glyph cp-item-icon">{@render navIcon(item.page)}</span>
								<span class="cp-item-label">{@render hl(item.page)}</span>
								<ArrowUpRight class="cp-go" strokeWidth={2.2} />
							{:else}
								<span class="cp-item-glyph cp-item-icon">{@render cpActionIcon(item.action.icon)}</span>
								<span class="cp-item-label">{@render hl(item.action.label)}</span>
								{#if item.action.hint}<span class="cp-kbd">{item.action.hint}</span>{/if}
							{/if}
						</button>
					{/each}
				{/each}
				{#if paletteItems.length === 0}
					<p class="cp-empty">No results for “{paletteQuery.trim()}”</p>
				{/if}
			</div>
			<div class="cp-foot">
				<span class="cp-foot-hint"><span class="cp-kbd">↑</span><span class="cp-kbd">↓</span> navigate</span>
				<span class="cp-foot-hint"><span class="cp-kbd">↵</span> select</span>
				<span class="cp-foot-hint"><span class="cp-kbd">esc</span> close</span>
			</div>
		</div>
	{/if}

	<!-- Drag to resize (double-click to reset) -->
	{#if !collapsed}
		<div
			class="resize-handle"
			class:active={resizing}
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize sidebar"
			use:tooltip={{ text: "Drag to resize · double-click to reset", placement: "left" }}
			onpointerdown={startResize}
			onpointermove={onResizeMove}
			onpointerup={endResize}
			onpointercancel={endResize}
			ondblclick={resetWidth}
		></div>
	{/if}

	<!-- Account hover card: rich "account at a glance" anchored to the row -->
	{#if hoverAccount && !collapsed}
		{@const d = accountDetail(hoverAccount)}
		{@const up = d.deltaAbs >= 0}
		{@const path = trendPath(d.points, 264, 52)}
		<div class="acard" class:flip={hoverFlip} style="top: {hoverTop}px; left: {hoverLeft}px">
			<div class="acard-head">
				<span class="acard-status">{@render statusIcon(hoverAccount.status)}</span>
				<div class="acard-title">
					<span class="acard-name">{hoverAccount.name}</span>
					<span class="acard-sub">{d.institution} · {d.type}</span>
				</div>
			</div>

			<div class="acard-balrow">
				<span class="acard-ballabel">Balance</span>
				<span class="acard-bal" class:neg={hoverAccount.negative}>{hoverAccount.amount}</span>
			</div>

			<div class="acard-chart">
				<svg viewBox="0 0 264 52" preserveAspectRatio="none" class:up class:down={!up}>
					<defs>
						<linearGradient id="acardgrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
							<stop offset="100%" stop-color="currentColor" stop-opacity="0" />
						</linearGradient>
					</defs>
					<path d={path.area} fill="url(#acardgrad)" stroke="none" />
					<path
						d={path.line}
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
				</svg>
				<div class="acard-chart-foot">
					<span class="acard-period">30 days</span>
					<span class="acard-delta" class:up class:down={!up}>
						{up ? "▲" : "▼"}
						{Math.abs(d.deltaPct).toFixed(1)}%
						<span class="acard-delta-abs">{up ? "+" : "−"}{money(d.deltaAbs)}</span>
					</span>
				</div>
			</div>

			{#if d.showLedger}
				<div class="acard-div"></div>
				<div class="acard-lines">
					<div class="acard-line">
						<span class="k">Cleared</span>
						<span class="v">{d.cleared}</span>
					</div>
					{#if d.unclearedCount}
						<div class="acard-line">
							<span class="k">Uncleared <span class="acard-badge">{d.unclearedCount}</span></span>
							<span class="v" class:neg={d.unclearedNegative}
								>{d.unclearedNegative ? "−" : "+"}{d.unclearedAmount}</span
							>
						</div>
					{/if}
				</div>
			{/if}

			{#if d.upcoming.length}
				<div class="acard-div"></div>
				<div class="acard-block-label">Upcoming</div>
				<div class="acard-lines">
					{#each d.upcoming as u}
						<div class="acard-sched">
							<span class="acard-date">{u.date}</span>
							<span class="acard-payee">{u.payee}</span>
							<span class="acard-amt" class:neg={u.negative}>{u.negative ? "−" : "+"}{u.amount}</span>
						</div>
					{/each}
				</div>
			{/if}

			<div class="acard-sync acard-sync-{hoverAccount.status}">
				<span class="acard-sync-dot">{@render statusIcon(hoverAccount.status)}</span>
				<span>{d.syncText}</span>
			</div>
		</div>
	{/if}

	<!-- Account right-click context menu -->
	{#if menuAccount}
		{@const a = menuAccount}
		{@const linked = a.status !== "manual"}
		<div class="ctx" style="top: {menuY}px; left: {menuX}px">
			<button type="button" class="ctx-item" onclick={() => startRename(a)}>
				{@render ctxIcon("rename")}<span>Rename</span>
			</button>
			<button
				type="button"
				class="ctx-item"
				onclick={(e) => {
					e.stopPropagation();
					if (menuAnchorRect) openIconPicker(menuAnchorRect, a);
				}}
			>
				{@render ctxIcon("emoji")}<span>Change icon…</span>
			</button>
			{#if a.icon}
				<button type="button" class="ctx-item" onclick={() => removeIcon(a)}>
					{@render ctxIcon("close")}<span>Remove icon</span>
				</button>
			{/if}
			{#if linked}
				<button type="button" class="ctx-item" onclick={() => syncNow(a)}>
					{@render ctxIcon("sync")}<span>Sync now</span>
				</button>
			{/if}
			<button type="button" class="ctx-item" onclick={() => reconcile(a)}>
				{@render ctxIcon("reconcile")}<span>Reconcile…</span>
			</button>
			<button type="button" class="ctx-item" onclick={() => toggleBankLink(a)}>
				{@render ctxIcon(linked ? "unlink" : "link")}<span>{linked ? "Unlink bank" : "Link bank"}</span>
			</button>
			<div class="ctx-div"></div>
			<button type="button" class="ctx-item danger" onclick={() => closeAccount(a)}>
				{@render ctxIcon("close")}<span>Close account</span>
			</button>
		</div>
	{/if}

	<!-- Category (sub-group) right-click context menu -->
	{#if menuGroup}
		{@const g = menuGroup}
		<div class="ctx" style="top: {menuY}px; left: {menuX}px">
			<button type="button" class="ctx-item" onclick={() => startGroupRename(g)}>
				{@render ctxIcon("rename")}<span>Rename</span>
			</button>
			<div class="ctx-div"></div>
			<button type="button" class="ctx-item danger" onclick={() => removeCategory(g)}>
				{@render ctxIcon("ungroup")}<span>Remove category</span>
			</button>
		</div>
	{/if}

	<!-- Account icon picker (Emoji / Logo / Upload) -->
	{#if iconAccount}
		<div
			class="ipick"
			style="top: {iconY}px; left: {iconX}px"
			bind:this={iconPickerEl}
			role="dialog"
			aria-label="Account icon"
		>
			<div class="ipick-tabs">
				<button class="ipick-tab" class:active={iconTab === "emoji"} onclick={() => (iconTab = "emoji")}
					>Emoji</button
				>
				<button class="ipick-tab" class:active={iconTab === "logo"} onclick={() => (iconTab = "logo")}
					>Logo</button
				>
				<button class="ipick-tab" class:active={iconTab === "upload"} onclick={() => (iconTab = "upload")}
					>Upload</button
				>
				<button class="ipick-close" aria-label="Close" onclick={closeIconPicker}>
					<X size={16} />
				</button>
			</div>

			{#if iconTab === "emoji"}
				<div class="ipick-pane">
					<input class="ipick-input" type="text" placeholder="Search emoji…" bind:value={emojiSearch} />
					{#if !emojiSearch.trim()}
						<div class="eg-tabs">
							{#each emojiGroups as g}
								<button
									class="eg-tab"
									class:active={emojiActiveGroup === g.name}
									title={g.name}
									onclick={() => scrollToEmojiGroup(g.name)}
									>{EMOJI_GROUP_ICONS[g.name] ?? "·"}</button
								>
							{/each}
						</div>
					{/if}
					<div class="eg-grid-wrap" bind:this={emojiGridWrap}>
						{#if filteredEmoji}
							{#if filteredEmoji.length}
								<div class="eg-grid">
									{#each filteredEmoji as e}
										<button
											class="eg-btn"
											title={e.name}
											onclick={() => chooseIcon({ type: "emoji", value: e.emoji })}
											>{e.emoji}</button
										>
									{/each}
								</div>
							{:else}
								<div class="ipick-hint">No results</div>
							{/if}
						{:else}
							{#each emojiGroups as g}
								<div data-egroup={g.name}>
									<div class="eg-label">{g.name}</div>
									<div class="eg-grid">
										{#each g.emojis as e}
											{#if !e.skin_tone_support || !e.name.includes("skin tone")}
												<button
													class="eg-btn"
													title={e.name}
													onclick={() => chooseIcon({ type: "emoji", value: e.emoji })}
													>{e.emoji}</button
												>
											{/if}
										{/each}
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{:else if iconTab === "logo"}
				<div class="ipick-pane">
					<input
						class="ipick-input"
						type="text"
						placeholder="bankofamerica.com"
						bind:value={logoDomain}
						oninput={onLogoInput}
						onkeydown={(e) => e.key === "Enter" && fetchLogo()}
					/>
					{#if logoUrl}
						<button
							class="logo-preview"
							class:loaded={logoLoaded}
							disabled={!logoLoaded}
							onclick={() => logoLoaded && chooseIcon({ type: "url", value: logoUrl! })}
						>
							{#if logoError}
								<span class="logo-err">No logo found</span>
							{:else}
								<img
									src={logoUrl}
									alt="logo"
									onload={() => {
										logoLoaded = true;
										logoError = false;
									}}
									onerror={() => {
										logoLoaded = false;
										logoError = true;
									}}
								/>
								{#if logoLoaded}<span class="logo-hint">Click to use</span>{/if}
							{/if}
						</button>
					{:else}
						<p class="ipick-hint">Type a domain to fetch its logo</p>
					{/if}
				</div>
			{:else}
				<div class="ipick-pane">
					<input
						type="file"
						accept="image/*"
						class="ipick-sr"
						bind:this={uploadInputEl}
						onchange={(e) => {
							const f = (e.target as HTMLInputElement).files?.[0];
							if (f) readImageFile(f);
						}}
					/>
					<div
						class="dropzone"
						class:over={uploadDragOver}
						role="button"
						tabindex="0"
						onclick={() => uploadInputEl?.click()}
						onkeydown={(e) => e.key === "Enter" && uploadInputEl?.click()}
						ondragover={(e) => {
							e.preventDefault();
							uploadDragOver = true;
						}}
						ondragleave={() => (uploadDragOver = false)}
						ondrop={(e) => {
							e.preventDefault();
							uploadDragOver = false;
							const f = e.dataTransfer?.files?.[0];
							if (f) readImageFile(f);
						}}
					>
						{#if uploadDataUrl}
							<img src={uploadDataUrl} alt="preview" class="dropzone-img" />
							<span class="ipick-hint">Click to replace</span>
						{:else}
							<Upload class="dropzone-icon" strokeWidth={1.5} />
							<span class="ipick-hint">Drop image or click to browse</span>
						{/if}
					</div>
					{#if uploadDataUrl}
						<button
							class="ipick-primary"
							onclick={() => chooseIcon({ type: "dataUrl", value: uploadDataUrl! })}
							>Use this image</button
						>
					{/if}
				</div>
			{/if}

			{#if iconAccount.icon}
				<div class="ipick-foot">
					<button class="ipick-remove" onclick={() => iconAccount && removeIcon(iconAccount)}
						>Remove icon</button
					>
				</div>
			{/if}
		</div>
	{/if}
</div>
