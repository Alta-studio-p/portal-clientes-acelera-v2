# Mapa de proceso para coaches

## Access and truth

The staff client workspace adds a process map, evidence-backed suggestions and
a per-session evolution. Only admins and currently assigned coaches can read
or change it. Client portal and client previews do not load these records.
Coach previews are read-only. Generated text is a suggestion, never an employment
decision, diagnosis or automatic confirmation of task completion.

Facts cite session aliases. Validation rejects unknown references, duplicate
topics and incomplete session coverage. Summaries are untrusted data, not model
instructions. A mention is not completion. Manual topic reviews and recommendation
decisions live separately and survive regeneration. Previous generated versions
are retained. Versions referencing a session no longer assigned to this client
are hidden to prevent leaking reassigned calls.
Unsupported statements and recommendations without a citation are omitted;
unsubstantiated topic states revert to pending. Verbose lists are shortened
deterministically, not sent back for another paid request. If no overview was
returned, the last two cited session changes are used without inventing new text.

## Model and costs (checked 2026-11-10)

Default: `google/gemini-2.5-flash-lite`. OpenRouter lists US$0.10/M input tokens
and US$0.40/M output tokens. A fictional two-session test returned validated
Spanish JSON in ~3 seconds for US$0.0004329. This is a small functional check,
not a quality benchmark. Llama 3.1 8B had no compatible endpoint under the same
routing constraints; Mistral Nemo timed out. No automatic model fallback or retry.

The request omits known names, emails, phone numbers and links, uses summaries
and next steps only (never transcripts), and sends only to the fixed OpenRouter
HTTPS endpoint. Redaction is minimization, not a guarantee of anonymity: names
of third parties not present in the known identity fields may remain in text.
Provider routing disallows data collection and requires structured-output support.
It enforces maximum provider prices of US$0.10/M input, US$0.40/M output.
Reasoning is explicitly disabled to avoid extra thinking-token charges.

Sources: https://openrouter.ai/google/gemini-2.5-flash-lite/pricing and
https://github.com/OpenRouterTeam/docs/blob/main/guides/routing/provider-selection.mdx

Each attempt reserves US$0.02 from a shared US$0.50/day (Colombia) cap under a
database advisory lock. Failed/interrupted attempts also consume reservations.
This is deliberately conservative; actual usage and reported cost are recorded
per successful version. Maximum 55KB user payload, 4500 output tokens, 60 sessions.
No request is made when the fingerprint already exists. Refreshing a page is free.
Failed identical requests have a 15-minute cooldown; concurrent requests for the
same client have a five-minute lease. API keys and raw error bodies are never logged.
Rate-limit, authentication and credit errors pause the shared queue for 15 minutes
and stop that batch immediately. No loop retries a paid request.

## Setup

Use the existing private database credentials and OpenRouter key; no public key:

```sh
node --env-file=.env.local scripts/setup-coaching-insights.mjs
node --env-file=.env.local scripts/refresh-coaching-insights.mjs --apply
```

Only additive private tables are created, with RLS enabled and browser/Data API
roles denied. Existing clients, summaries and contexts are never overwritten.
`OPENROUTER_API_KEY` or `LLM_API_KEY` is required on the server.
`SUPABASE_DATABASE_URL` is the existing verified-TLS database connection.

The production Vercel cron in `vercel.json` runs at 02:00 UTC (21:00 Colombia),
after the existing 20:00 import. `CRON_SECRET` must be configured in Vercel;
the endpoint fails closed without it. Cron processes up to 20 changed clients
within 180 seconds plus the last request, newest active clients first. Remaining
clients queue for the next run; an authorized coach can also request a refresh.
Old versions remain usable on failures and are marked stale when calls change.
Vercel activates the cron only after production deployment.

## Verification

```sh
node --test scripts/test-coaching-insights.mjs
```

The development-only `/login/ui-preview/journey` shows fictional data without any
model calls. Existing registration, matching and masterclass tests still apply.
