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
- Initialize default message templates only after successful password sign-in, never on session restoration or token refresh. Why: the existing idempotent RPC should run once per login session without blocking access on failure.
- Dashboard metrics read only the existing lead_metrics view through a user-scoped TanStack Query key; route loaders prime the cache and show bounded pending/error states. Why: private metrics must not cross accounts or stay loading after failure.
- All application writes must use TanStack Query mutations; the router MutationCache invalidates lead_metrics after every successful mutation. Why: future lead updates and imports automatically refresh the metrics without changing database objects.
- Lead list filters and pagination live in validated router search state and query the existing leads table through user-scoped keys with the shared ["leads"] prefix; cities are column-only batched reads. Why: filters combine server-side, exact pagination remains shareable, and future actions invalidate all list variants.
- The app shell provides one shared import dialog to the navbar and empty-list CTA. Why: both entry points must open the same placeholder without duplicating dialogs.
