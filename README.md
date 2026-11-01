# FIXFLIP

Existing Netlify project: `fixfliponline` (site ID `9d8cb84f-3cd0-4648-bc08-9b79feb3ee81`). Preserve the site's deploy history and domain assignments when linking this repository.

## Current state

Implementation prepared; not approved as a functioning live service until the activation checks below pass. Checkout buttons fail closed until the server reports readiness. No real customer charge is required for local tests.

## Deployment

Link this repository to the existing Netlify project. Branch: main; build: `npm run build`; publish: `public`; functions: `netlify/functions`. Requires Node 22+. Run `npm ci`, `npm test`, `npm run build`.

### Server-only environment

- `STRIPE_SECRET_KEY`: live, restricted read access to Checkout Sessions and line items, Subscriptions, Payment Intents and Charges. Add directly to Netlify's secret environment variables, never source code or chat.
- `SESSION_SECRET`: optional separate random session-signing secret; the code uses a purpose-separated HMAC with the Stripe secret if absent. Changing it signs customers out.
- AI: Netlify AI Gateway injects `OPENAI_API_KEY` and `OPENAI_BASE_URL` on eligible credit plans. Alternatively set your own server-side values. Default model: `gpt-5-mini`; optional `OPENAI_MODEL` override. Check credits and spend controls before launch.
- `ESCALATION_EMAIL_READY=true`: set only after enabling Netlify form detection, redeploying, configuring the `fixflip-escalations` form's email notification to `fixfliponline@gmail.com`, and confirming a test submission reached the inbox.
- `FIXFLIP_LIVE=true`: final activation switch. Leave unset until end-to-end payment, AI and escalation checks pass.

Do not put credentials in variables prefixed PUBLIC, VITE or NEXT_PUBLIC. No secrets belong in the static frontend.

## Checkout

Stripe merchant: Prestige Arbor Care LLC. Existing live products/prices are referenced in `lib/service.mjs`; do not create duplicates.

- Single: $19.99 once, price `price_1UX1R82MpNyYhiyuidg9Abqp`, link `plink_1UX1RY2MpNyYhiyusKKsLtrn`.
- Project Partner: $79/month, five projects per paid billing period, price `price_1UX1RH2MpNyYhiyuBKZugOZt`, link `plink_1UX1Rk2MpNyYhiyu7dqgi7wW`.
- Stripe portal supports period-end cancellation, payment-method changes and invoice history.
- Set both Payment Links' after-completion redirects to `https://fixfliponline.netlify.app/?session_id={CHECKOUT_SESSION_ID}#workspace` while custom-domain HTTPS is pending. After verifying HTTPS, use the canonical custom domain and update the portal return URL and legal URLs.
- The confirmation URL acts as an access capability. A server-signed Secure/HttpOnly/SameSite cookie lasts 30 days. The app removes the session ID from the address bar after exchange. Customers must retain the original confirmation URL for access restoration; this version has no separate password/magic-link account system.

## AI-first support

Only server-classified unresolved conversations submit the `fixflip-escalations` Netlify form. Notification delivery depends on the Netlify configuration above. Routine resolved chats are saved in Netlify Blobs and are not emailed. Failed AI requests escalate. Failed form submission remains pending and exposes a retry button. An accepted form submission means forwarding was submitted, not proof that Gmail delivered it. Never claim inbox delivery without testing.

Storage keys are purchase-specific or subscription-specific. Atomic conditional writes protect quotas from concurrent requests. Monthly projects reset using Stripe billing-period boundaries. Past-period projects remain readable. Maximum 20 customer messages/project/period and six requests/minute/purchase limit abuse. There is no automatic subject classifier preventing a customer from changing topics inside an existing project; review abuse manually.

## Activation checks

1. Install dependencies and run local tests; deploy to existing Netlify project.
2. Enable form detection and verify the detected form and notification recipient.
3. Add the restricted Stripe key privately and confirm AI Gateway availability.
4. Test checkout redirection and payment verification in an isolated Stripe test setup with test price IDs, then live-account readiness. Do not mix test keys with the hard-coded live prices.
5. Confirm an ordinary question returns AI guidance without a support email.
6. Confirm uncertainty forwards full conversation to the support inbox; ensure failures show pending instead of sent.
7. Confirm quota exhaustion, concurrent requests, duplicate retries, cancellation and refund access behavior.
8. Verify apex/www DNS and HTTPS before promoting the custom domain.
9. Set `FIXFLIP_LIVE=true` only after these checks. The current mock suite covers server invariants, not real Stripe credentials, AI availability or email delivery.

## Remaining limitations

No image uploads, human replies inside the app, automated email-delivery receipt tracking, automatic deletion/retention jobs or per-user email verification beyond possession of a completed checkout link. Personal replies occur by email. User-specific chat content is never part of the Git repository. Privacy and service terms are initial drafts and should reflect the actual operating process.

## Isolated sandbox checkout

`/test.html` uses `/test-api/*`, a separate Netlify Blobs store, a separate signed cookie, and `STRIPE_TEST_SECRET_KEY`. The sandbox key must belong to account `acct_1UWWEnRsNlbU5mNL`. Only test-mode checkout sessions and the sandbox single-question price are accepted. Production continues to accept only live-mode sessions and its original live prices, with its launch flags unchanged. Test conversations can send real escalation notifications; use synthetic repair questions and the owner's email only. Remove `STRIPE_TEST_SECRET_KEY` after testing to disable the test workspace.
