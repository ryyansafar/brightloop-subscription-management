#!/usr/bin/env bash
# After `npm run seed:full`, point the seeded demo customer (Northwind Retail) at the Resend
# account address, so invoice, payment and password-reset emails can really be delivered.
# Usage: scripts/demo-email-account.sh [email] [db-file]
set -euo pipefail
EMAIL="${1:-safarryyan@gmail.com}"
DB="${2:-prisma/dev.db}"
if [[ ! "$EMAIL" =~ ^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$ ]]; then echo "Invalid email: $EMAIL" >&2; exit 1; fi
if [ "$(sqlite3 "$DB" "select count(*) from User where email='$EMAIL';")" != "0" ]; then
  echo "$EMAIL already exists in $DB. Nothing to do."; exit 0
fi
sqlite3 "$DB" <<SQL
update User set email='$EMAIL' where email='customer@brightloop.test';
update Customer set email='$EMAIL' where userId=(select id from User where email='$EMAIL');
SQL
echo "Demo customer now uses $EMAIL (password unchanged: Demo@12345). Log in with that address."
