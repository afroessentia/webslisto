<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All app pages live under src/routes/_authenticated/ (client-only gate redirecting to /login); /login is the only public page. Why: single-user internal tool, everything is private.
- Initialize default message templates after successful password sign-in, never on session restoration or token refresh; an empty composer template query may call the RPC and refetch once. Why: initialize each login while recovering missing templates only when needed.
- Dashboard metrics read only the existing lead_metrics view through a user-scoped TanStack Query key; route loaders prime the cache and show bounded pending/error states. Why: private metrics must not cross accounts or stay loading after failure.
- All application writes must use TanStack Query mutations; the router MutationCache invalidates lead_metrics after every successful mutation. Why: future lead updates and imports automatically refresh the metrics without changing database objects.
- Lead list filters and pagination live in validated router search state and query the existing leads table through user-scoped keys with the shared ["leads"] prefix; cities are column-only batched reads, and website totals are owner-scoped head-only counts under that same prefix. Why: filters combine server-side, exact pagination remains shareable, and lead changes invalidate both list variants and website totals.
- The app shell provides one shared CSV/API import dialog to all authenticated pages; its context and hook live outside the dialog component module. Why: navbar and page actions share progress and preserve context identity during hot updates. CSV parsing and cleaning are pure helpers, and browser-owned imports use batched TanStack mutations for safe imports without schema changes.
- CSV preview and import share an owner-scoped existing-phone lookup under the ["leads"] query prefix; the mutation repeats the lookup immediately before writing. Why: preview counts refresh with lead changes and stale previews cannot bypass phone exclusion.
- API polling uses a browser-only timing helper with per-operation cancellation; the batch coordinator reuses that helper sequentially inside a TanStack mutation, with a stop-after-current flag distinct from abort. Recovery and imported-history reads are owner-scoped, and manual collect actions are serialized mutations. Why: StrictMode cleanup cannot masquerade as timeout, batches cannot create concurrent paid searches, and verification never starts another run.
- Lead actions use browser-owned RLS queries and TanStack mutations, only inserting whatsapp_click events; status events remain trigger-owned. Why: preserve existing schema and avoid double audit entries.
- WhatsApp opens synchronously once per composer before saving; writes re-read status and use a status-match guard. Why: popup blockers and stale list data must not cause duplicate opens or overwrite newer funnel status.
- Optimistic status updates affect all cached lead list variants and roll back only the failed lead's attempted status. Why: failures must not revert unrelated concurrent lead changes.
- Notes drawers mount their editor and user-scoped history query only while open; edits use narrow patches and URL changes omit manual website status. Why: avoid closed-drawer reads and let the existing classification trigger run without stale status overrides.
- Lead detail entry points reuse LeadNotesDrawer; read-only details and list website links share pure formatting and URL helpers. Why: keep link safety and business details consistent without additional database reads or writes.
- The template editor and WhatsApp composer share templatesOptions; editor drafts and saved baselines stay separate per key, and saves invalidate the owner-scoped templates cache. Why: refresh composer text without losing unsaved edits in the other tab.
- The /fila daily queue reads leads and today's whatsapp_click count under the shared ["leads"] key prefix; skips are in-memory and the goal lives in localStorage. Why: every lead mutation refreshes the queue without extra invalidation wiring or schema changes.
- Follow-ups use owner/day/section-scoped queries under ["leads"], primed by the protected route loader; shared status actions fill default dates with a conditional null-only write before a status-only fallback. Why: all entry points refresh together and automatic dates never overwrite concurrent manual scheduling without database changes.
- Funnel actions (replies, proposals, loss reasons, "Sem WhatsApp", WhatsApp-click undo) live in src/lib/lead-funnel.ts with Europe/Madrid day helpers in src/lib/madrid-time.ts; results use ["funnel"]-prefixed queries invalidated by every lead action. Why: one place for funnel writes and consistent Madrid-day boundaries across filters, export and results.
