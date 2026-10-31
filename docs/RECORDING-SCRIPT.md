# Recording script: exact clicks, typing and words (target 5:30)

Everything below was walked through in Chrome on the dev server and passed (31 Oct, 16:50).
Use **http://localhost:3000** only. Not `127.0.0.1`, which blocks the page's JavaScript in dev.

## A. Setup (about 10 minutes, before recording)
```
cd ~/make-a-ton && git pull && npm install
npx prisma migrate deploy && npx prisma generate
npm run seed:full                      # about 25 s, resets all data
scripts/demo-email-account.sh          # points the demo customer at safarryyan@gmail.com
npm run dev                            # port 3000, leave running; never restart it while recording
# optional second terminal, retries any failed email: npm run mail:worker
```
`.env` must have `APP_ORIGIN=http://localhost:3000`, `EMAIL_PROVIDER=resend`, a `RESEND_API_KEY`, `EMAIL_FROM=onboarding@resend.dev`.

Chrome, two tabs, 100% zoom, notifications off, bookmarks bar hidden:
- **Tab 1:** http://localhost:3000/login
- **Tab 2:** Gmail, search `from:onboarding@resend.dev`, leave it open

Warm-up (so nothing compiles on camera): log in as admin and open Dashboard, Subscriptions, Invoices,
Payments, Billing run, and each Catalog tab once. Sign out. Wait on the login page about 5 seconds
before typing, since the page needs a moment to finish loading.

Logins (password `Demo@12345`): `admin@brightloop.test`, `staff@brightloop.test`,
`safarryyan@gmail.com` (the customer, after step A).

Do **not**: restart the server, click "Create invoice" twice, or use a "Bill as of" date past 20 Nov.

## B. The take

### 0:00 Intro (login page)
- Show the login page for 3 seconds.
- SAY: "Brightloop sells everything on subscription and ran it from spreadsheets. We built one platform that runs plans, subscriptions, billing and reporting."
- TYPE `admin@brightloop.test` in Email, click Password, TYPE `Demo@12345`, press **Enter**.

### 0:25 Dashboard
- Move the mouse slowly across the 8 cards: Active subscriptions, MRR, ARR, Churned, Revenue, Payments received, Outstanding, Overdue.
- HOVER one bar in the "Billed vs collected" chart to show the tooltip.
- CLICK the **Plan** dropdown, choose **Monthly Starter**, click **Apply**. The numbers change. Set it back to **All plans** and Apply.
- SAY: "About 2,200 active subscriptions and 15,000 invoices. MRR, ARR, payments, outstanding and overdue in one view, filterable by date and plan, and it loads in well under two seconds."

### 1:10 Catalog (sidebar > Products)
- Products table: point at **Brightloop CRM**, click the **3 options** link in the Variants column to show Standard / Odoo / Enterprise.
- SAY: "Products have variants. The Odoo brand adds ₹560."
- CLICK the **Plans** tab. SAY: "Plans define the billing period, minimum quantity and availability."
- CLICK **Quotation templates**. SAY: "Templates pre-fill a plan and its lines."
- CLICK **Discounts** (4 rules). Point at Volume 10%, Loyalty ₹500, and the Exhausted and Expired rows.
- SAY: "Percent or fixed discounts, with dates and usage limits. Only the admin can change these."

### 2:00 New subscription (sidebar > Subscriptions > New subscription)
- CLICK **Customer**, TYPE `safarryyan`, CLICK **Ryyan Demo Customer** (after step A, the name is Northwind Retail (Demo): type `northwind` instead).
- **Plan:** choose **Monthly Starter**.
- **Product:** choose **Brightloop CRM**. **Variant:** choose **Brand: Odoo (+₹560.00)**. Unit price becomes ₹2,960.
- **Qty:** triple-click, TYPE `5`. Tax stays GST 18%. Point at Subtotal, Tax, Total.
- SAY: "Variant price, tax and totals update live."
- CLICK **Create subscription**. The page opens on SUB-0xxxx as Draft. Point at the ₹500 discount line.
- SAY: "A loyalty discount was applied automatically."
- CLICK **Send quotation**, then **Confirm**, then **Activate**. Point at the status bar moving Draft, Quote, Confirmed, Active.
- SAY: "Anyone can see where it stands. Activating also emails the customer a confirmation."

### 3:00 Invoice, email and payment (stay on the subscription)
- CLICK **Create invoice**. CLICK the invoice link that appears in the right panel.
- Point at: Discount −₹500, Tax ₹2,574, Total ₹16,874.
- CLICK **Confirm**. CLICK **Send** (toast: "Invoice email submitted for delivery").
- CLICK **Print** only if you want to show the A4 layout; press Escape to close.
- SWITCH to **Tab 2 (Gmail)**: show "Your Brightloop subscription … is active" and "Brightloop invoice …". Switch back.
- SAY: "Customers get the invoice and a confirmation by email."
- CLICK **Record payment**. Amount: triple-click, TYPE `6874`, Method **UPI**, CLICK **Save payment**. Point at "Amount due ₹10,000".
- CLICK **Record payment** again. Amount: TYPE `20000`, CLICK **Save payment**. The red error appears: "Cannot be more than the amount due".
- SAY: "Overpayment is blocked."
- Amount: TYPE `10000`, CLICK **Save payment**. Status turns **Paid**, amount due ₹0.
- SWITCH to **Tab 2**: show "Payment received…" with the receipt and the "Congratulations… paid in full" message.
- SAY: "A receipt for the part payment and a thank-you when it is paid in full."

### 4:00 Billing run (sidebar > Billing run)
- Point at "Due today 0". SAY: "Today everything is already billed. I will simulate a later billing day."
- Click the **Bill as of** date, TYPE `07112026` (or pick 7 Nov 2026). It says about 576 subscriptions are due. Point at the simulation notice.
- CLICK **Run billing**. In the dialog read the sentence, CLICK **Run billing**. Wait about 10 seconds.
- Point at the result cards: invoices created (about 1,000), periods already invoiced 0, closed at plan end.
- Point at the button now saying **Run billing (nothing due)**. SAY: "Run it again and nothing is billed twice, because each period is unique per subscription in the database. Month-ends keep their anchor day and prices are snapshotted on every invoice."

### 4:40 Roles
- CLICK **Sign out**. Log in as `staff@brightloop.test` / `Demo@12345`.
- Point at the sidebar: no Billing run, no Staff users. In the address bar TYPE `localhost:3000/billing`: it bounces to the dashboard.
- SAY: "Staff can work with subscriptions and invoices but cannot change the catalog, create staff or run billing. This is enforced on the server."
- Sign out. Log in as `safarryyan@gmail.com` / `Demo@12345`. Show the portal: only this customer's subscriptions and invoices. Open one invoice, click **Print**.
- Optional (15 s): open a subscription with an expiry date and click **Renew**.
- SAY: "Customers see only their own data and can renew or close their own subscriptions. Another customer's invoice returns not found."

### 5:15 Close
- Show the GitHub repo and the commit graph with all four authors.
- SAY: "Next.js, Prisma and SQLite. About 380 automated tests on every commit, and each teammate committed their own module."

## C. If something goes wrong
- Page or click does nothing: reload and wait 5 seconds. Do not restart the server.
- Wrong data or a bad take: run `npm run seed:full` and `scripts/demo-email-account.sh`, then start again.
- Email missing: wait 30 seconds and check Spam. Only `safarryyan@gmail.com` receives mail (Resend test mode).
- Skip email beats entirely if time is short. The product demo stands without them.
