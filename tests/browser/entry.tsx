// Isolated visual fixture; this file is never imported by an application route.
import { createRoot } from "react-dom/client";
import { ShopApp } from "../../src/components/shop-app";
import type { ShopData } from "../../src/lib/types";
const data: ShopData = {
  tenant: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "متجر الاختبار",
    owner_name: "أرين",
    email: "shop@example.com",
    phone: "+972599123456",
    active: true,
    logo_path: null,
    created_at: "2026-09-17T10:00:00Z",
  },
  settings: {
    days_before_event: 2,
    days_after_event: 2,
    fitting_days_before_event: 14,
    same_town_warning_enabled: true,
    notifications_enabled: true,
    timezone: "Asia/Jerusalem",
  },
  categories: [],
  dresses: [],
  customers: [],
  bookings: [],
  fittings: [],
  offers: [],
  notifications: [],
  today: "2026-09-17",
};
if (new URLSearchParams(location.search).has("rentals")) {
  const dressId = "00000000-0000-4000-8000-000000000002";
  const categoryId = "00000000-0000-4000-8000-000000000003";
  data.categories = [
    { id: categoryId, name: "فساتين", visible: true, image_path: null },
  ];
  data.dresses = [
    {
      id: dressId,
      category_id: categoryId,
      code: "W-1",
      name: "فستان الاختبار",
      color: "أبيض",
      size: "M",
      default_price: 1000,
      notes: "",
      status: "available",
      visible: true,
      image_path: null,
    },
  ];
  data.bookings = ["سارة", "ريم"].map((name, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i + 4}`,
    number: i + 1,
    customer_id: `customer-${i}`,
    customer_name: name,
    customer_phone: "0599999999",
    secondary_phone: "",
    customer_city: "",
    customer_town: "بيرزيت",
    customer_type: "bride",
    event_date: `2026-10-${i === 0 ? "10" : "20"}`,
    status: "active",
    original_subtotal: 1000,
    automatic_discount: 0,
    calculated_total: 1000,
    agreed_total: 1000,
    offer_snapshot: [],
    notes: "",
    payments: [],
    booking_items: [
      {
        id: `item-${i}`,
        booking_id: `00000000-0000-4000-8000-00000000000${i + 4}`,
        dress_id: dressId,
        dress_name: "فستان الاختبار",
        dress_code: "W-1",
        category_name: "فساتين",
        original_price: 1000,
        price: 1000,
        offer_price: 1000,
        offer_name: "",
        blocked_from: `2026-10-${i === 0 ? "08" : "18"}`,
        blocked_until: `2026-10-${i === 0 ? "12" : "22"}`,
        delivery_date: `2026-10-${i === 0 ? "08" : "18"}`,
        expected_return_date: `2026-10-${i === 0 ? "12" : "22"}`,
        actual_return_date: null,
        status: "reserved",
        active: true,
      },
    ],
  }));
}
createRoot(document.getElementById("root")!).render(<ShopApp data={data} />);
