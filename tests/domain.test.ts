import { test } from "node:test";
import assert from "node:assert/strict";
import { shiftDate, overlaps, itemStatus, balance } from "../src/lib/domain";
import type { Item, Booking } from "../src/lib/types";
test("inclusive rental period covers October 8–12", () => {
  assert.equal(shiftDate("2026-10-10", -2), "2026-10-08");
  assert.equal(shiftDate("2026-10-10", 2), "2026-10-12");
  assert.ok(overlaps("2026-10-12", "2026-10-16", "2026-10-08", "2026-10-12"));
  assert.ok(!overlaps("2026-10-13", "2026-10-17", "2026-10-08", "2026-10-12"));
});
test("calendar arithmetic crosses leap years and month boundaries", () => {
  assert.equal(shiftDate("2028-03-01", -2), "2028-02-28");
  assert.equal(shiftDate("2027-01-01", -2), "2026-12-30");
});
test("overdue state is computed from dates", () => {
  const i = {
    actual_return_date: null,
    expected_return_date: "2026-10-12",
    active: true,
    status: "delivered",
  } as Item;
  assert.equal(itemStatus(i, "2026-10-13"), "late");
  assert.equal(
    itemStatus(
      { ...i, actual_return_date: "2026-10-12", status: "returned" },
      "2026-10-13",
    ),
    "returned",
  );
});
test("balance sums multiple booking-level payments", () => {
  assert.equal(
    balance({
      agreed_total: 2200,
      payments: [{ amount: 500 }, { amount: 300 }],
    } as Booking),
    1400,
  );
});
