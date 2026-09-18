# Connected acceptance checklist

Run against a separate Supabase staging project with migrations applied. This checklist requires project credentials; local SQL tests do not prove provider/network behavior.

1. Bootstrap the specified Super Admin; verify email/password login routes to `/admin`. Confirm the normal login has no registration link and Auth signup is disabled in Supabase.
2. Create Shop A and Shop B with separate verified email addresses and contact phone numbers. Verify email/password login with Phone disabled. Confirm default categories exist in each shop. Edit an existing phone-only shop to add email and verify the same password, user UUID, membership and bookings are preserved.
3. Create, edit, hide/show and safely delete an unused category and dress. Upload JPEG/PNG/WebP images and a logo. Confirm tenant-prefixed private Storage paths, signed-image rendering, and rejection of oversized/invalid files.
4. In Shop A create W-1, W-2 and W-3, then one bride agreement for October 10. Default W-1 range must be October 8–12 inclusive. Include three items, negotiate 2200 and deposit 500. Check the remaining balance is 1700 and only one customer/agreement is created.
5. Submit two overlapping W-1 bookings from separate browser contexts simultaneously. Exactly one should succeed. An October 14 event still overlaps on October 12; an October 15 event succeeds. W-2 is independently available.
6. Add a bundle targeting W-1 and W-2 at 1500, starting before the event. Verify automatic offer evaluation and a final agreed total override. Test percentage/fixed offers, inactive/expired offers and incomplete explicit bundles.
7. Update inventory price and offer definitions. Reload old agreements: snapshots and balances must not change. Explicit editing should show its recalculation warning.
8. Book W-1 outside the blocked period for another bride in the same town. Warning appears and save succeeds. Disable the warning setting and repeat. Verify physical overlaps continue to fail.
9. Confirm the bride fitting defaults to 14 days before the event, in store timezone. Companion bookings have no automatic fitting. Edit date/status and verify day/week/month/list navigation opens the booking.
10. Deliver one item, return it, move it to cleaning, then available. The other two retain their statuses. Attempt another delivery before the physical item is returned/cleaned: it must fail. Attempt to mark that item available through inventory edit: it must fail.
11. Record a second payment and check payment history and balance. Reject overpayment and invalid negative prices. Cancel an undelivered booking and verify its dates become free while its financial history remains.
12. Create an overdue delivered item. Check the dashboard, quick return search and notification center without opening its booking. Read a notification and reload; read state remains saved.
13. With Shop B's authenticated REST client, attempt to select/update Shop A's UUIDs, inject Shop A's tenant ID, reference Shop A's dress in a booking, invoke workflow RPCs on Shop A records, and upload/read another tenant's image path. All must fail or return zero rows.
14. Disable Shop A while its browser is logged in. Refresh or invoke a Server Action: no operational data should be available. Reactivate and verify recovery. Test invalid and duplicate phone edits; account remains disabled after failed Auth changes until corrected.
15. Verify mobile widths 390px and tablet 768px, keyboard dialogs, Arabic RTL, search/filtering, server errors, empty states, and booking print output.
16. Run `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build`, and `npm run test:browser`. Deploy to a Vercel preview with staging variables and repeat login, booking save, and image upload over HTTPS.

Never use production customer records in automated tests. Delete only fixtures in the dedicated staging project when finished.
