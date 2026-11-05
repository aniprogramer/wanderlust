# Wanderlust: Runbook

How to run, release and recover the production site. Nothing here has been run against real services yet; the first run is part of `STAGING_CHECKLIST.md`.

## 1. Environment variables

Set these on the host. Never commit values. The full list with purposes is in `ARCHITECTURE.md` section 12.

The app **refuses to start in production** without: `SECRET`, `ATLAS`, `APP_URL`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `SUPPORT_EMAIL`, `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`. The error names what is missing.

Also set for launch: `MAPBOX_TOKEN`, `MAPBOX_SERVER_TOKEN`, `LEGAL_ENTITY_NAME`, `LEGAL_ADDRESS`, `GRIEVANCE_OFFICER`, `GOVERNING_LAW`. Optional: `SENTRY_DSN`, `SOCIAL_*_URL`, `APP_TIMEZONE` (default `Asia/Kolkata`).

Set `LEGAL_REVIEWED=true` only after a lawyer has reviewed the pages in `views/legal/`.

## 2. Deploy

`render.yaml` describes one web service. `Dockerfile` builds the same app for any container host.

1. Confirm CI is green on the commit.
2. Take a backup (section 4) if the release contains a new file in `migrations/`.
3. Run `npm run migrate:status` against production, then `npm run migrate` (section 6).
4. Deploy.
5. Check `GET /health` returns `{"status":"ok"}`. Load the home page and one stay. Watch the logs for 10 minutes.

## 3. Roll back

- **Code:** redeploy the previous successful release from the host's dashboard.
- **Data:** migrations do not run backwards. They only add fields and fill in defaults, so the previous code keeps working with migrated data in the normal case. If data itself is wrong, restore from backup (section 5). That loses everything written since the backup, so decide it deliberately.

## 4. Atlas backups

Owner task: not verifiable from this repository.

1. In Atlas, open the cluster and turn on Cloud Backup. The free M0 tier does not include it, so production needs a paid tier.
2. Choose a schedule and retention that suit you. Write the choice here once made.
3. Before a risky migration, take an on-demand snapshot.

## 5. Restore drill

Do this before launch and after any backup setting changes. **Never restore over production for a drill.**

1. Create a temporary Atlas cluster.
2. Restore the latest snapshot into it.
3. Point a local copy of the app at it with `ATLAS` in a local `.env` and `NODE_ENV=development`.
4. Check that listing counts match and that a known booking opens.
5. Delete the temporary cluster and note the date and how long the restore took.

| Date | Snapshot | Time to restore | Result | By |
| --- | --- | --- | --- | --- |
| | | | | |

## 6. Migrations

Numbered files in `migrations/`. Each runs once, is recorded in the `migrations` collection and is safe to run twice.

```bash
npm run migrate:status   # lists each migration and whether it has run
npm run migrate          # applies what is outstanding
```

Both print which database they point at. Run them from a machine with the production `ATLAS` set. A new migration is a new numbered file; never edit one that has run.

**The first deploy of this release must run the migrations.** Listings with no capacity get defaults flagged `capacityDefaulted`, and hosts see a prompt to correct them.

## 7. Seed script

`node init/index.js` deletes all listings, reviews and bookings. It never runs with `NODE_ENV=production`. Elsewhere it needs both `ALLOW_DESTRUCTIVE_SEED=true` and `--yes`, and it refuses any database URL containing a value from `PROTECTED_DB_MARKERS`. Keep `ALLOW_DESTRUCTIVE_SEED` unset on every real host, and list your production cluster in `PROTECTED_DB_MARKERS` on any machine that can reach it.

## 8. Rotating secrets

| Secret | How | Effect |
| --- | --- | --- |
| `SECRET` | Replace and redeploy | Everyone is logged out |
| `ATLAS` password | Add a new database user, update, redeploy, remove the old user | None if done in that order |
| `CLOUD_API_SECRET` | New key in Cloudinary, update, redeploy, revoke the old key | None |
| `MAPBOX_*` | New token, restrict it by URL, update, redeploy, delete the old token | None |
| `SMTP_PASS` | New credential, update, redeploy, revoke the old one | Mail fails briefly if revoked first |

Rotate immediately if a secret appears in a log, a commit or a screenshot.

## 9. Admin rights

Only by command, never by a form:

```bash
npm run make-admin -- <username>            # add --yes in production
npm run make-admin -- <username> --revoke
```

## 10. Incident checklist

1. **Confirm.** Open `/health` and the home page. Check the host's status page and Atlas.
2. **Note the time** and what users see.
3. **Find it.** Logs are JSON lines. Search by `requestId`, which every response also returns in the `X-Request-Id` header. Check Sentry if it is configured.
4. **Stop the harm.** Roll back the code (section 3). Hide a bad listing from `/admin`.
5. **Tell people.** If bookings, personal data or email were affected, tell those users plainly what happened.
6. **Personal data leak:** rotate the affected secrets and speak to your lawyer the same day about notification duties. Do not decide this alone.
7. **Write it up:** what happened, when, why, and what stops it next time.

Common causes:

| Symptom | Likely cause | Check |
| --- | --- | --- |
| App will not start | Missing variable | The startup error names it |
| `/health` returns 503 | Atlas unreachable | Atlas status, IP allow list |
| Emails do not arrive | SMTP credentials, or SPF and DKIM | Search the logs for the failed send; check the provider |
| Upload errors | Cloudinary key or quota | Cloudinary dashboard |
| Map empty, rest fine | Mapbox token, or URL restriction too tight | Browser console |
| Everyone gets 429 | Proxy trust wrong, so all users share one IP | `trust proxy` in `app.js`, number of proxies in front |
