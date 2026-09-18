export type Category = {
  id: string;
  name: string;
  visible: boolean;
  image_path: string | null;
  image_url?: string;
};
export type Dress = {
  id: string;
  category_id: string;
  code: string;
  name: string;
  color: string;
  size: string;
  default_price: number;
  notes: string;
  status: string;
  visible: boolean;
  image_path: string | null;
  image_url?: string;
};
export type Customer = {
  id: string;
  name: string;
  phone: string;
  secondary_phone: string;
  city: string;
  town: string;
  notes: string;
};
export type Item = {
  id: string;
  booking_id: string;
  dress_id: string;
  dress_name: string;
  dress_code: string;
  category_name: string;
  original_price: number;
  price: number;
  offer_price: number;
  offer_name: string;
  blocked_from: string;
  blocked_until: string;
  delivery_date: string;
  expected_return_date: string;
  actual_return_date: string | null;
  status: string;
  active: boolean;
};
export type Payment = {
  id: string;
  booking_id: string;
  amount: number;
  payment_date: string;
  note: string;
};
export type AppliedOffer = {
  id: string;
  name: string;
  kind: string;
  value: number;
  discount: number;
};
export type Booking = {
  id: string;
  number: number;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  secondary_phone: string;
  customer_city: string;
  customer_town: string;
  customer_type: string;
  event_date: string;
  status: string;
  original_subtotal: number;
  automatic_discount: number;
  calculated_total: number;
  agreed_total: number;
  offer_snapshot: AppliedOffer[];
  notes: string;
  booking_items: Item[];
  payments: Payment[];
};
export type Fitting = {
  id: string;
  booking_id: string;
  scheduled_at: string;
  status: string;
  notes: string;
};
export type Offer = {
  id: string;
  name: string;
  kind: string;
  value: number;
  min_items: number;
  starts_on: string;
  ends_on: string;
  active: boolean;
  offer_targets: { dress_id: string | null; category_id: string | null }[];
};
export type Notice = {
  id: string;
  booking_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};
export type Settings = {
  days_before_event: number;
  days_after_event: number;
  fitting_days_before_event: number;
  same_town_warning_enabled: boolean;
  notifications_enabled: boolean;
  timezone: string;
};
export type Tenant = {
  email?: string;
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  active: boolean;
  logo_path: string | null;
  created_at: string;
  logo_url?: string;
};
export type ShopData = {
  tenant: Tenant;
  settings: Settings;
  categories: Category[];
  dresses: Dress[];
  customers: Customer[];
  bookings: Booking[];
  fittings: Fitting[];
  offers: Offer[];
  notifications: Notice[];
  today: string;
};
export type Quote = {
  original_subtotal: number;
  item_subtotal: number;
  automatic_discount: number;
  calculated_total: number;
  offers: AppliedOffer[];
  item_quotes: { dress_id: string; offer_price: number; offer_name: string }[];
};
export type Availability = {
  dress_id: string;
  unready: boolean;
  conflict: boolean;
  same_town: boolean;
};
export type RentalInput = {
  dress_id: string;
  price?: number;
  blocked_from?: string;
  blocked_until?: string;
  delivery_date?: string;
  expected_return_date?: string;
};
