#!/bin/sh
# Build the crontab with values baked in (busybox crond does not reliably
# export the container environment into job shells), then run crond in the
# foreground. Schedules are UTC, matching vercel.json.
set -e

: "${CRON_TARGET:?CRON_TARGET is required (e.g. http://web:3000)}"

# Roll lapsed AUTO commitments forward — 16:10 UTC (00:10 MYT).
# Send due-date reminders        — 01:00 UTC (09:00 MYT), after advance-cycles.
cat > /etc/crontabs/root <<EOF
10 16 * * * curl -fsS -m 30 -H "Authorization: Bearer ${CRON_SECRET}" "${CRON_TARGET}/api/cron/advance-cycles" >/dev/null 2>&1
0 1 * * * curl -fsS -m 30 -H "Authorization: Bearer ${CRON_SECRET}" "${CRON_TARGET}/api/cron/due-reminders" >/dev/null 2>&1
EOF

echo "[cron] Scheduler armed (advance-cycles 16:10 UTC, due-reminders 01:00 UTC) -> ${CRON_TARGET}"
exec crond -f -l 8
