# Vercel notification backend

## Notification activation and tab performance (8 November 2026)

Production environment inspection confirmed that `VINTRA_NOTIFICATIONS_ENABLED`
was missing from `vintrastudios-projects/vintrachat-xoxo`. The CLI successfully
added it as a Production-only Config variable with value `true`. The connector's
403 did not apply to the CLI credentials. Preview delivery remains disabled by
the existing server guard.

Redeployed the existing production deployment `dpl_3Pxcba8Xkh1jbbHTi1w98YMmaMUE`
with the updated environment. Replacement
[`dpl_3pkKKwYpsreCg4d4WQrUnmjKKhkj`](https://vercel.com/vintrastudios-projects/vintrachat-xoxo/3pkKKwYpsreCg4d4WQrUnmjKKhkj)
is READY and serves `https://chat.vintrastudio.com`. Post-release checks: home
200, unsigned notification request 401, zero error/fatal log records in the
initial ten-minute query window. No announcement or test push was sent.

The mobile transport now preserves the server's actionable 404/503 error message
instead of replacing every such error with “not activated yet”. Hidden inbox and
notification tabs pause their aurora animations. The inbox memoizes its visible
chat list so rendering does not repeatedly restart the saved-widget storage read;
duplicate quick-reply reads and the tab bar's extra auth subscription were removed.

Validation: mobile TypeScript, five API transport tests, iOS bundle export and
23 backend notification/auth tests passed. Lint has no errors (three existing
warnings). Physical-device delivery and tab timing have not been measured.
Mobile performance changes require reloading the development app or a new build.

## Customer chat alerts (26 October 2026)

`customer-chat-notifications.patch` contains a follow-up for the website checkout
at `/Users/martinsecker/Documents/vintrachat_xoxo`. It fixes incoming support-chat
messages failing to save and enqueue a push when the route uses Firestore
`arrayUnion`. Every new customer message uses the existing sound-enabled push
payload and opens the correct chat when tapped; device sound/notification settings
are respected and replayed messages do not create another alert.

The patch is applied and published from website commit `8725dbc`. It is an incremental
patch on top of the 26 October activation release, not a replacement for the older
combined patches below. Production deployment
[`dpl_DLVo5Ng2u4BoccrJfB6v1EqipMKC`](https://vercel.com/vintrastudios-projects/vintrachat-xoxo/DLVo5Ng2u4BoccrJfB6v1EqipMKC)
is **READY** and serves `https://chat.vintrastudio.com` (26 October 2026).
No mobile rebuild is needed. Post-deploy checks: home 200, unsigned notifications
and access requests 401, empty support-message request 400; no error/fatal runtime
logs were returned for this deployment in the check window. No real push was sent.
Verified: 23 notification/auth tests, 12 Firestore emulator tests, website
TypeScript/build, mobile TypeScript and 4 transport tests. Phone delivery has not
been tested during this change. See `my-app/NOTIFICATIONS.md` for details.

## Original integration

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
and safe invitation acceptance. Website commit `96d2167` and the tested Firestore rules
were published on 23 October. Production signed-account checks now pass. The old
`FIRESTORE_RULES.txt` targets the wrong schema and must not be published.

iOS **1.0.0 (9)** from mobile commit `dfb7f8d` was built successfully and uploaded to
App Store Connect on 25 October:
[build](https://expo.dev/accounts/vintrastudio/projects/VintraApp/builds/51348747-04a0-4741-b781-f86a788c77ec),
[successful submission](https://expo.dev/accounts/vintrastudio/projects/VintraApp/submissions/584830fc-f2bd-4182-a2d6-464fd7fb966f).
Apple processing and installation on a phone remain unverified. `eas.json` now pins
the existing App Store Connect app ID `6776323865` for subsequent submissions.
The 26 October server follow-up (`a2a6f21`) lets the verified Vintra admin open the
panel and lets all active business roles register for announcements, including users
and viewers. Customer-message pushes still require a support role or ownership.
Sending requires `VINTRA_NOTIFICATIONS_ENABLED=true` in Vercel Production and a redeploy;
the temporary migration gate has been removed, and Preview never sends. Device
registration and the panel work while sending is off. No new native build is needed
beyond 1.0.0 (9) for this server change. No real announcement or push was sent by testing.

Locally verified: mobile TypeScript and 4 transport tests; website TypeScript, production
build, 20 notification/auth tests, 12 emulator tests, and unsigned/origin HTTP checks.
Actual phone delivery has not been tested. No paid service or Firebase Functions
deployment is needed.
