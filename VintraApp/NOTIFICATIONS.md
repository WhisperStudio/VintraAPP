# Notification delivery — Vercel migration

The mobile app now calls `https://chat.vintrastudio.com/api/notifications` using a Firebase
ID token. It no longer calls Firebase callable functions. Firebase Auth and Firestore remain
in use; this route does not require upgrading Firebase to Blaze.

The matching website implementation is in the separate local checkout
`../../vintrachat-notifications`, branch `codex/vercel-notifications`, repository
`WhisperStudio/vintrachat_xoxo`, app root `my-app`. See its `my-app/NOTIFICATIONS.md` for
activation requirements, tests, retry behavior and rollout steps.

**Not deployed or activated.** Live Firestore rules still grant unrestricted access as of
23 October 2026. Protect server-only notification data and migrate ownership/membership and
invitation access in both clients before activation. The server defaults to disabled until
`VINTRA_NOTIFICATIONS_ENABLED=true` is configured. No billing or live configuration changed.

The server uses existing Vercel Functions and Expo Push; no Firebase Functions or paid scheduler
is required. Usage counts against existing Vercel/Firestore quotas. Retries and receipt checks
run on subsequent requests, not a periodic timer, so quiet periods can delay recovery.

The old TestFlight build still calls Firebase Functions. After the server and access rules are
ready, build and distribute this updated app, then connect notifications on each phone. Merely
pushing this mobile repository does not deploy the website backend.

Optional build-time setting: `EXPO_PUBLIC_NOTIFICATION_API_URL`, a trusted HTTPS endpoint.
No backend credentials belong in the app. Test app HTTP behavior with Node 24:
`node --test tests/notification-api.test.mjs`.

## Legacy Firebase Functions implementation

`functions/` and `firebase.json` are retained as the previous, undeployed implementation.
Do not deploy them alongside the Vercel implementation. The notes below describe that previous
implementation and its earlier validation, not the current app transport.


## What is implemented

- Native device registration is authenticated through Firebase callable functions, per Expo token, across all accessible businesses. Devices refresh on app start, resume, and token rotation. Sign-out removes registration before ending the session.
- Android has separate channels for sound/vibration combinations. iOS vibration follows system notification settings. Settings synchronize opt-out to the server; a local preference alone cannot stop a background push.
- `notifyIncomingChat` observes `businesses/{businessId}/supportChats/{chatId}`. It diffs the embedded `messages` array and queues every new visitor (`user` or missing role) message, even when a subsequent AI response is in the same write. Support/assistant/system messages do not alert the support staff. This is a staff app; website visitors are not registered as mobile recipients.
- Announcement sends use an authenticated, server-authorized callable. The existing verified `vintrastudio@gmail.com` account and verified users with the `superAdmin` custom claim can broadcast. Hidden tabs are not authorization.
- Jobs have stable IDs and per-device attempts; accepted tickets are skipped on retries. Network failures retry up to five attempts. As with any external push service, a crash between provider acceptance and saving its ticket can cause a duplicate; exactly-once device delivery is not guaranteed.
- The scheduled receipt checker records provider confirmation and disables unregistered tokens. An accepted ticket is not proof of delivery or reading.
- Notification taps open the associated business and chat, including cold starts. The app validates business access before selecting it.
- Browser alerts use live Firestore listeners while the page is running. Closed-browser push is **not** implemented; it needs a web push service worker and FCM web credentials. The UI explicitly describes this limitation.

## Verified deployment blockers (22 October 2026)

A read-only check of the connected Firebase project found:

- No deployed Cloud Functions.
- Billing disabled. A billing-enabled Firebase project is needed for these functions and scheduled jobs.
- No Firebase Android app registered for the package in `app.json`.
- The deployed Firestore rules grant `allow read, write: if true` for every document.

**Do not deploy this backend under the current rules.** Anyone could read device tokens, forge notification jobs, or change a business membership. First replace the public rules with verified membership/ownership checks and deny all client access to the new server-only collections. Review the connected website's visitor chat, invitations, and account setup before applying rules; its complete source is not in this repository. In particular, clients must not be able to grant themselves staff membership or change a business's owner.

No production database rules, billing settings, app registrations, or deployments were changed by this work. The code and local tests are complete; real-device background delivery is not yet verified.

## Deployment (after resolving the blockers)

From `VintraApp`:

```sh
npm --prefix functions ci
npm --prefix functions test
firebase deploy --only functions:vintra-notifications --project vintrasolutions-f58a7
```

The configuration uses a separate `vintra-notifications` functions codebase, Node 22, and `us-central1` (also set in `src/lib/push-sender.ts`). Firebase billing and the Cloud Functions / Eventarc / Cloud Scheduler APIs must be available. No composite Firestore indexes are required.

Functions: `registerNotificationDevice`, `unregisterNotificationDevice`, `notificationCenter`, `queueAnnouncement`, `notifyIncomingChat`, `deliverNotification`, `retryNotifications`, `checkNotificationReceipts`.

All new collections are **server-only**: `notificationDevices`, `notificationJobs` (including `attempts`), `notificationAnnouncements`, and `notificationReceipts`. Existing Firestore security rules must deny direct client reads and writes to these paths. Do not add a blanket authenticated-user rule. Existing rules are not stored in this repository and are not replaced by this configuration. If your project has a broad recursive allow rule, narrow it before deploying this service; explicit deny rules cannot override another matching allow rule. The app uses callable functions exclusively for these collections.

The legacy `pushTokens` collection is not used for sending. Users must open the updated app once to register with the new service. Existing legacy `notificationQueue` logs are left intact; the new screen shows new jobs.

If Expo push access-token security is enabled, configure `EXPO_ACCESS_TOKEN` in the Functions environment. Never use an `EXPO_PUBLIC_*` variable for it.

## Native build requirements

The Expo project ID is already in `app.json`. Check APNs credentials for the iOS bundle and FCM v1 credentials for Android using `eas credentials`. Android also requires the Firebase Android app's `google-services.json`, referenced by `expo.android.googleServicesFile`. That file is not present in this repository; do not substitute the web Firebase app's config.

Rebuild the native app after adding `react-native-svg` and `expo-linear-gradient`. Use a development or production build for remote push testing, not Expo Go on Android.

References: [Expo SDK 55 notifications](https://docs.expo.dev/versions/v55.0.0/sdk/notifications/), [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Firebase Firestore triggers](https://firebase.google.com/docs/functions/firestore-events).

## Device acceptance checks

1. Sign into a verified staff account on two phones; connect notifications in Settings. Both should remain registered. Switch to Analytics or Settings.
2. Send two visitor messages from the website, including a message answered immediately by AI. Each phone should receive both alerts in foreground, background, and after the app is terminated.
3. Tap an alert from another business: it should select that business, clear the widget filter, and open the matching conversation. Repeat from a cold start.
4. Disable notifications, then send a message. This phone should receive no remote alert; the other phone should still receive one. Repeat with sound and vibration preferences (iOS vibration is system-controlled).
5. Send a test announcement to your phone before a real broadcast. Confirm queued → accepted, and later provider receipt counts. Verify no-recipients and failed results never display as success.
6. Sign out on a shared phone, then send another message. The signed-out phone must not receive it. Sign into another account and confirm it only receives that account's business conversations.
7. On web, grant browser permission and keep the page open while sending a visitor message. Click the alert and confirm the conversation opens. Closing the browser is outside the supported web flow.

## Checks completed locally

- TypeScript: passed.
- ESLint: no errors; nine existing warnings remain in unrelated/unchanged sections.
- Expo exports: web, iOS, and Android passed. These are JavaScript/Hermes exports, not signed native builds.
- iOS CocoaPods: new SVG and gradient modules installed successfully.
- Backend: ten tests cover message diffing, duplicate events, legacy messages, permission checks, input validation, device tokens, and result classification.
- Headless Chrome with mocked authentication and notification endpoints: desktop/mobile layout, queuing one announcement, disabling a zero-device audience, searching history, and restoring a draft after reload passed. No page errors or horizontal mobile overflow. No real announcements were sent.
- Actual APNs/FCM delivery, cold-start notification navigation, and the deployed Firestore-to-push flow remain unverified pending the setup above.
