# Tiny scheduler that mirrors vercel.json crons: it curls the two
# bearer-guarded cron endpoints on the same UTC schedules.
FROM alpine:3.20
RUN apk add --no-cache curl tzdata
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
