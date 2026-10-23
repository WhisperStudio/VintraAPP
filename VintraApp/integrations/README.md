# Vercel notification backend

`vercel-notifications.patch` contains the matching website changes, including tests
and activation documentation. It targets `WhisperStudio/vintrachat_xoxo` at commit
`791257323af5afb15a68134a6bc34cf038cbe90d`, with Next.js under `my-app`.

The patch is already applied in the local sibling checkout
`../../vintrachat-notifications`, on branch `codex/vercel-notifications`.
From a **clean website checkout** at that base commit, apply with:

```sh
git apply --check /path/to/vercel-notifications.patch
git apply /path/to/vercel-notifications.patch
cd my-app
npm ci
npm run test:notifications
npm run build
```

Read the resulting `my-app/NOTIFICATIONS.md` before deployment. The server stays
disabled by default. Current production Firestore access rules must be migrated
and tested before enabling it. This patch does not change those rules, billing,
environment variables, or production deployments.

Publishing only the mobile repository does not deploy this backend. The app
transport and the website API must be released together; existing TestFlight
builds still use the old Firebase callable functions.

## Security migration follow-up (23 October 2026)

The completed follow-up lives in `/Users/martinsecker/Documents/vintrachat_xoxo` on
`codex/secure-vercel-notifications`. Read that checkout's `my-app/NOTIFICATIONS.md`.
The original patch above is preserved for reference and is not the final release.
`vercel-notifications-secure.patch` contains the combined website changes against
base `791257323af5afb15a68134a6bc34cf038cbe90d`; apply it only to a clean checkout at
that base, not on top of the original patch or newer work.

The current mobile source additionally requires `/api/access` for business discovery
and safe invitation acceptance. The API was 404 on the production domain during
verification; publishing a preview alone will not fix mobile sign-in. Publish the
completed website and tested Firestore rules together, keeping notifications disabled,
then build a new TestFlight app. The old `FIRESTORE_RULES.txt` targets the wrong schema.

Locally verified: mobile TypeScript and 4 transport tests; website TypeScript, production
build, 17 notification/auth tests, 12 emulator tests, and unsigned/origin HTTP checks.
Actual phone delivery has not been tested. No paid service or Firebase Functions
deployment is needed.
