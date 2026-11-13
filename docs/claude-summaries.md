# Claude subscription: call summaries

The independent routine `Acelera Portal — Resúmenes de llamadas` translates the
existing Fathom summary, next steps and display title. Fathom import, coach
assignments, recording links and the rendering format do not change. No videos
are re-transcribed. Client maps and the other enrichment scripts are separate
features and still use their existing provider.

## Configuration

- Apply `supabase-claude-summaries.sql` with the private database connection.
- Store `CLAUDE_SUMMARY_FIRE_URL` and `CLAUDE_SUMMARY_FIRE_TOKEN` as Vercel secrets.
- Set `CLAUDE_SUMMARIES_ENABLED=1` in production only after a synthetic test.
- Preserve `CRON_SECRET`; it protects dispatch, not client-data access.
- The route is `/api/internal/claude-summary`; individual payload and callback
  requests use a six-hour random per-job bearer token stored only as a hash.
- Keep the routine without connectors or repositories. It accepts URLs only on
  the production portal origin and the above route. It posts `{result: ...}`.

Vercel dispatches pending work hourly at :30 UTC. The existing nightly import
translation step also dispatches the same queue (no workflow permission changes
needed). The script defaults to `SUMMARY_PROVIDER=claude-routine`; OpenRouter
requires an explicit override for rollback and is never used as a fallback.

## Safety and limits

Up to three concurrent runs and twenty dispatches per rolling day. Duplicate
source snapshots cannot enqueue again. A request with an ambiguous outcome is
not immediately retried because Claude's fire endpoint has no idempotency key.
After six hours it expires; at most one further attempt is allowed after a full
day. Explicit authentication, permission and rate refusals pause new dispatches
for six hours. Subscription exhaustion inside a session may only be visible in
Claude; the queue then marks the missing result as expired. No extra usage or
paid API fallback is enabled by this integration.

The callback locks the job and call, compares the original snapshot hash, and
refuses stale writes. Spanish fields and manually edited profile contexts are
preserved. Completed callbacks are idempotent. Empty, malformed, still-English,
link-dropping and heavily truncated translations are rejected. Private jobs are
not readable by anonymous, authenticated, or service-role REST clients.

## Verification

`node --test scripts/test-claude-summaries.mjs` exercises contracts and safety.
`scripts/check-claude-routine.mjs` creates a synthetic private job with no client
association and starts it through the deployed route. It never reads or updates
real client summaries. It prints only status, not tokens or call content.

Inspect aggregate operational status with a private database connection:

```sql
select status, count(*) from private.claude_summary_jobs
where not fixture group by status;
```

Do not regenerate the evaluation routine's token or change its instructions.
