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
