# 05 — Database Schema (Supabase Postgres) & Auth
**Product:** সেবাঘর · **Version:** 1.0 · **Date:** 2026-11-13
Conventions: `snake_case`, `timestamptz` always (UTC), money = `integer` ৳ (no paisa), UUID PKs (`gen_random_uuid()`), `created_at default now()`, soft-delete via `active/archived` flags (no hard deletes of business rows). All DDL in `supabase/schema.sql`; all RLS in `supabase/policies.sql` (idempotent: `drop policy if exists … create policy …`).

---

## 1. Enum types
```sql
create type order_status as enum (
  'placed','pending_verification','confirmed','in_progress','ready','completed','cancelled'
);
create type payment_method as enum ('cash_on_pickup','bkash','nagad','rocket','bank','other');
create type payment_status as enum ('not_paid','pending','verified','rejected');
create type service_category as enum ('print','photocopy','scan','typing','photo','online','design','deed','other');
create type proof_status as enum ('none','sent','approved','changes_requested');
```

## 2. Tables

### 2.1 `profiles` (1:1 with `auth.users`)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | `references auth.users(id) on delete cascade` |
| `full_name` | text | yes | from signup form |
| `phone` | text | yes | `^01[3-9]\d{8}$`; used for wa.me + guest match |
| `address` | text | yes | optional (pickup default) |
| `bn_digits` | boolean | no | default `true` (user preference) |
| `created_at` | timestamptz | no | default now() |
| `is_admin` | boolean | no | **not writable by user** — service role only; mirror of JWT app_metadata for RLS convenience |
Indexes: `unique lower(phone) where phone is not null` (partial, for guest join), `idx_profiles_phone`.

### 2.2 `services`
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | gen_random_uuid() |
| `slug` | text unique | no | lowercase-hyphen, stable URLs |
| `name_bn` | text | no | e.g. `B&W প্রিন্ট (প্রতি পেজ)` |
| `description_bn` | text | yes | short; may include size/price notes |
| `category` | service_category | no | indexed |
| `unit_bn` | text | no | `পেজ` / `পিস` / `কপি` / `ফিক্সড` |
| `base_price` | integer | no | ৳; `check (base_price >= 0)` |
| `options_schema` | jsonb | yes | e.g. `{"color":["B&W","রঙিন"],"sides":["একপাতা","দুপাতা"]}` — UI renders from this |
| `requires_file` | boolean | no | default true for print/scan/design/deed |
| `eta_bn` | text | yes | `১–৩ ঘণ্টা` |
| `active` | boolean | no | default true; "deactivate" = hidden from catalog |
| `sort_order` | integer | no | default 100; admin reorders |
| `created_at`/`updated_at` | timestamptz | no | default now() |
Indexes: `idx_services_active_sort (active, sort_order)`, `idx_services_category`.

### 2.3 `orders`
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | never exposed in public URLs |
| `order_date` | date | no | default `current_date` (local shop day) |
| `token` | integer | no | daily sequence; **unique (order_date, token)** |
| `customer_id` | uuid | yes | `references profiles(id)`; null = guest |
| `guest_name` | text | yes | required when `customer_id is null` (check) |
| `guest_phone` | text | yes | required when guest (check) — track key |
| `status` | order_status | no | default `placed` |
| `subtotal` | integer | no | sum of item line totals (server-computed) |
| `discount` | integer | no | default 0; `check (discount between 0 and subtotal)` |
| `total` | integer | no | `check (total = subtotal - discount)` |
| `paid` | integer | no | default 0; `check (paid between 0 and total)` |
| `due` | integer | generated | `total - paid` (stored generated col) |
| `payment_method` | payment_method | no | default `cash_on_pickup` |
| `payment_status` | payment_status | no | default `not_paid` |
| `pickup_slot` | text | yes | free text slot label from settings (আজ সন্ধ্যা…) |
| `notes` | text | yes | customer instructions |
| `rework` | boolean | no | default false (admin flag → PRD metric) |
| `created_at`/`updated_at` | timestamptz | no | now(); `updated_at` via trigger |
| `created_by` | uuid | yes | admin who created on behalf (counter sale) |
Indexes: `idx_orders_date_token unique (order_date, token)`, `idx_orders_status_date (status, order_date)`, `idx_orders_customer (customer_id)`, `idx_orders_guest_phone (guest_phone) where guest_phone is not null`.
Checks: `guest or account` — `(customer_id is not null) or (guest_name is not null and guest_phone is not null)`.

### 2.4 `order_items`
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `order_id` | uuid FK | no | `references orders(id) on delete cascade` |
| `service_id` | uuid FK | yes | `references services(id)`; null if service later deleted |
| `name_snapshot` | text | no | service name at order time |
| `unit_snapshot` | text | no | e.g. `পেজ` |
| `qty` | numeric(10,2) | no | `check (qty > 0)` |
| `unit_price` | integer | no | snapshot |
| `line_total` | integer | generated | `round(qty * unit_price)` stored |
| `options` | jsonb | yes | chosen options (color/sides/…) |
Indexes: `idx_order_items_order (order_id)`.

### 2.5 `order_files`
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `order_id` | uuid FK | no | on delete cascade |
| `file_path` | text | no | `order-files/tmp/<uuid>-<name>` |
| `original_name` | text | no | sanitized display only |
| `mime` | text | no | whitelist check |
| `size_bytes` | integer | no | `check (size_bytes <= 10*1024*1024)` |
| `kind` | text | no | `source` (customer) / `proof` (admin) / `nid` (doc job) |
| `uploaded_at` | timestamptz | no | now() |
Indexes: `idx_order_files_order`, `idx_order_files_kind`.

### 2.6 `order_events` (audit log — every status change)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint PK | no | identity |
| `order_id` | uuid FK | no | cascade |
| `from_status` | order_status | yes | null on creation |
| `to_status` | order_status | no | |
| `actor` | uuid | yes | null = system/RPC |
| `note` | text | yes | e.g. cancel reason, verify note |
| `created_at` | timestamptz | no | now() |
Indexes: `idx_order_events_order`.

### 2.7 `payments`
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `order_id` | uuid FK | no | cascade |
| `method` | payment_method | no | bkash/nagad/rocket/bank |
| `amount` | integer | no | `check (amount > 0)` |
| `trx_id` | text | yes | bKash/Nagad TrxID; `unique` where not null |
| `status` | payment_status | no | default `pending` |
| `verified_by` | uuid | yes | admin id |
| `verified_at` | timestamptz | yes | |
| `note` | text | yes | rejection reason |
| `created_at` | timestamptz | no | now() |
Indexes: `idx_payments_order`, `unique (trx_id) where trx_id is not null`.

### 2.8 `design_proofs` (design jobs proof loop)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid PK | no | |
| `order_id` | uuid FK | no | cascade |
| `round` | integer | no | `check (round between 1 and 10)` |
| `file_path` | text | no | proofs bucket |
| `status` | proof_status | no | default `sent` |
| `customer_note` | text | yes | change requests |
| `sent_at` | timestamptz | no | now() |
| `responded_at` | timestamptz | yes | |
Indexes: `idx_design_proofs_order`.

### 2.9 `shop_settings` (singleton id=1)
| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | integer PK | no | `check (id = 1)` |
| `shop_name` | text | no | সেবাঘর — … |
| `address_bn` | text | yes | |
| `phone` | text | yes | |
| `opening_hours_bn` | text | yes | |
| `bkash_number`/`bkash_name` | text | yes | ANNOUNCED on payment screen |
| `nagad_number`/`nagad_name` | text | yes | |
| `pickup_slots` | jsonb | no | `["আজ সন্ধ্যা ৬–৮টা","আগামীকাল সকাল","আগামীকাল দুপুর"]` |
| `receipt_footer_bn` | text | yes | |
| `bn_digits` | boolean | no | default true |
| `updated_at` | timestamptz | no | |

### 2.10 Trigger: `updated_at` maintenance
`moddatetime` on `orders`, `services`, `payments` (or explicit trigger function `set_updated_at()`).

## 3. RPCs (SECURITY DEFINER — the only write path for customers)
```sql
-- Create order: server computes prices; returns new order + token
create or replace function create_order(
  p_items jsonb,           -- [{service_id, qty, options}]
  p_customer jsonb,        -- {name, phone, notes, pickup_slot, payment_method} — customer_id NOT accepted; derived from auth.uid()
  p_trx_id text default null,
  p_files jsonb default '[]'  -- [{file_path, kind, size_bytes, mime, original_name}] from wizard tmp/ uploads; inserted as order_files inside this RPC
) returns table(order_id uuid, token int, total int)
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid; v_token int; v_subtotal int := 0; v_line int; v_svc record; v_item jsonb;
begin
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'empty_order';
  end if;
  -- guest orders require name+phone (matches table check constraint → friendly error instead of 23514)
  if auth.uid() is null and (nullif(p_customer->>'name','') is null or nullif(p_customer->>'phone','') is null) then
    raise exception 'guest_info_required';
  end if;
  -- validate & price server-side
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_svc from services where id = (v_item->>'service_id')::uuid and active limit 1;
    if not found then raise exception 'service_unavailable:%', v_item->>'service_id'; end if;
    if (v_item->>'qty')::numeric <= 0 or (v_item->>'qty')::numeric > 9999 then raise exception 'qty_invalid'; end if;
    v_line := round((v_item->>'qty')::numeric * v_svc.base_price);
    v_subtotal := v_subtotal + v_line;
  end loop;
  -- TrxID format (if paid upfront): 8–12 uppercase alphanumerics
  if p_trx_id is not null and p_trx_id !~ '^[A-Z0-9]{8,12}$' then raise exception 'trx_invalid'; end if;
  -- every file must live under the tmp/ prefix + allowed mime/size/kind (prevents claiming someone else's object)
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) f
    where (f->>'file_path') !~ '^order-files/tmp/[A-Za-z0-9._-]+$'
       or coalesce(f->>'mime','') not in ('application/pdf','image/jpeg','image/png')
       or coalesce(nullif(f->>'size_bytes','')::integer, 0) <= 0
       or coalesce(nullif(f->>'size_bytes','')::integer, 0) > 10485760
       or coalesce(f->>'kind','source') not in ('source','nid')
  ) then raise exception 'files_invalid'; end if;
  -- daily token (advisory lock kills the read-max-then-insert race)
  perform pg_advisory_xact_lock(hashtext(current_date::text));
  select coalesce(max(token), 0) + 1 into v_token from orders where order_date = current_date;
  insert into orders(order_date, token, customer_id, guest_name, guest_phone,
                     subtotal, total, payment_method, payment_status, pickup_slot, notes, status)
  values (current_date, v_token,
          auth.uid(),  -- caller; NEVER trust a client-supplied customer_id
          case when auth.uid() is null then nullif(p_customer->>'name','') end,
          case when auth.uid() is null then nullif(p_customer->>'phone','') end,
          v_subtotal, v_subtotal,
          coalesce(nullif(p_customer->>'payment_method','')::payment_method, 'cash_on_pickup'),
          case when p_trx_id is not null then 'pending'::payment_status else 'not_paid'::payment_status end,
          p_customer->>'pickup_slot', p_customer->>'notes',
          case when p_trx_id is not null then 'pending_verification'::order_status else 'placed'::order_status end)
  returning id into v_order;
  -- items snapshot
  insert into order_items(order_id, service_id, name_snapshot, unit_snapshot, qty, unit_price, options)
  select v_order, s.id, s.name_bn, s.unit_bn,
         (i->>'qty')::numeric, s.base_price, i->'options'
  from jsonb_array_elements(p_items) i
  join services s on s.id = (i->>'service_id')::uuid;
  -- attach wizard-uploaded files (rows written here so guests never need client INSERT on order_files)
  insert into order_files(order_id, kind, file_path, size_bytes, mime, original_name)
  select v_order, coalesce(f->>'kind','source'), f->>'file_path',
         nullif(f->>'size_bytes','')::integer, f->>'mime',
         coalesce(nullif(f->>'original_name',''),'file')
  from jsonb_array_elements(p_files) f;
  if p_trx_id is not null then
    insert into payments(order_id, method, amount, trx_id, status)
    values (v_order, coalesce(nullif(p_customer->>'payment_method','')::payment_method,'bkash'), v_subtotal, p_trx_id, 'pending');
  end if;
  insert into order_events(order_id, from_status, to_status, actor, note)
  values (v_order, null, (case when p_trx_id is not null then 'pending_verification' else 'placed' end)::order_status,
          auth.uid(), 'order created');
  return query select v_order, v_token, v_subtotal;
end $$;

-- Guest tracking: token + phone → minimal row, no PII leakage
create or replace function track_order(p_token int, p_phone text)
returns table(order_id uuid, token int, status order_status, total int, paid int, due int, items jsonb, events jsonb, pickup_slot text)
language sql security definer set search_path = public as $$
  select o.id, o.token, o.status, o.total, o.paid, o.due,
         (select coalesce(jsonb_agg(jsonb_build_object('name', i.name_snapshot, 'qty', i.qty, 'total', i.line_total)), '[]'::jsonb)
            from order_items i where i.order_id = o.id),
         (select coalesce(jsonb_agg(jsonb_build_object('to', e.to_status, 'at', e.created_at) order by e.created_at), '[]'::jsonb)
            from order_events e where e.order_id = o.id),
         o.pickup_slot
  from orders o
  where o.token = p_token and o.order_date = current_date
    and regexp_replace(coalesce(o.guest_phone, (select phone from profiles where id = o.customer_id)), '\D','','g') = regexp_replace(p_phone, '\D','','g');
$$;

-- Admin-only status advance with transition guard
create or replace function advance_order_status(p_order_id uuid, p_to order_status, p_note text default null)
returns orders language plpgsql security definer set search_path = public as $$
declare v_from order_status; v_row orders;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select status into v_from from orders where id = p_order_id for update;
  -- allowed transitions matrix
  if not (
    (v_from = 'placed'               and p_to in ('confirmed','cancelled')) or
    (v_from = 'pending_verification' and p_to in ('confirmed','cancelled')) or
    (v_from = 'confirmed'            and p_to in ('in_progress','cancelled')) or
    (v_from = 'in_progress'          and p_to = 'ready') or
    (v_from = 'ready'                and p_to = 'completed')
  ) then raise exception 'invalid_transition:%→%', v_from, p_to; end if;
  update orders set status = p_to where id = p_order_id;
  insert into order_events(order_id, from_status, to_status, actor, note) values (p_order_id, v_from, p_to, auth.uid(), p_note);
  return (select * from orders where id = p_order_id);
end $$;

-- Admin: verify / reject payment
create or replace function set_payment_status(p_payment_id uuid, p_status payment_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update payments set status = p_status, verified_by = auth.uid(), verified_at = now(), note = p_note where id = p_payment_id;
  if p_status = 'verified' then
    perform advance_order_status((select order_id from payments where id = p_payment_id), 'confirmed', 'payment verified');
  elsif p_status = 'rejected' then
    -- legal only from pending_verification; invalid state raises invalid_transition and rolls back
    perform advance_order_status((select order_id from payments where id = p_payment_id), 'cancelled', coalesce(p_note, 'payment rejected'));
  end if;
end $$;

-- Helper for RLS
create or replace function service_popularity()
returns table(service_id uuid, orders bigint)
language sql stable security definer set search_path = public as $$
  select i.service_id, count(*)::bigint
  from order_items i
  join orders o on o.id = i.order_id and o.status <> 'cancelled'
  where i.service_id is not null
  group by i.service_id;
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
      or coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;
```

## 4. Storage buckets
```
order-files   (private)  10 MB,  application/pdf, image/jpeg, image/png
proofs        (private)  10 MB,  image/jpeg, image/png, application/pdf
shop-assets   (public)   5 MB,   svg/webp/jpg/png  (logo, samples, banner)
```
Storage path convention: wizard uploads ALWAYS land in `order-files/tmp/<uuid>-<safe_name>` (no order exists yet at upload time). File ownership is attached to the order **inside `create_order()` (`p_files` arg)** — clients never INSERT into `order_files` directly, which is what makes guest orders work. NID-tagged files keep `kind='nid'` for the 30-day purge.
Storage policies (Storage → Policies, `storage.objects`):
```sql
-- anyone (guest wizard) may INSERT under tmp/ only; cannot read back
create policy order_files_insert_tmp on storage.objects for insert
  with check (bucket_id = 'order-files' and (storage.foldername(name))[1] = 'tmp');
-- owner reads own files (via order ownership) or admin reads everything
create policy order_files_read_own on storage.objects for select
  using (bucket_id = 'order-files' and (
     is_admin()
     or exists (select 1 from order_files f join orders o on o.id = f.order_id
                where f.file_path = 'order-files/' || name and o.customer_id = auth.uid())));
-- proofs: admin writes; customer reads proofs on own orders
create policy proofs_admin_all on storage.objects for all
  using (bucket_id = 'proofs' and is_admin()) with check (bucket_id = 'proofs' and is_admin());
create policy proofs_read_own on storage.objects for select
  using (bucket_id = 'proofs' and (
     is_admin()
     or exists (select 1 from design_proofs p join orders o on o.id = p.order_id
                where p.file_path = 'proofs/' || name and o.customer_id = auth.uid())));
-- admin may DELETE order-files objects (needed for the 30-day NID purge)
create policy order_files_delete_admin on storage.objects for delete
  using (bucket_id = 'order-files' and is_admin());
-- shop-assets: public read, admin write
create policy assets_read on storage.objects for select using (bucket_id = 'shop-assets');
create policy assets_admin_write on storage.objects for insert
  with check (bucket_id = 'shop-assets' and is_admin());
```
Signed URLs (60s) for downloads (admin views/customer downloads their own). Storage 1GB free — NID purge keeps `order-files` small.

## 5. Row Level Security — full matrix
| Table | customer (anon/auth) | admin |
|---|---|---|
| `profiles` | select/update **own row only** (no `is_admin` change — column privilege revoked) | select all |
| `services` | select `where active` | all (incl. price edit, deactivate) |
| `orders` | select own (`customer_id = auth.uid()`) — guests have no rows → track via RPC only | all + update |
| `order_items` | select via order ownership (join) | all |
| `order_files` | select via order ownership only; **no client INSERT/UPDATE/DELETE** — rows are written inside `create_order()` from `p_files` (path under `tmp/`) | all |
| `order_events` | select via order ownership (timeline) | all |
| `payments` | select own order's rows | all + update via `set_payment_status` only |
| `design_proofs` | select own; update only `status/customer_note` of latest `sent` proof (via RPC preferred) | all |
| `shop_settings` | select (public info + payment numbers needed for pay screen) | update |
| `services` insert/update/delete | — | admin only |
Representative policies (idempotent):
```sql
alter table orders enable row level security;
drop policy if exists orders_select_own on orders;
create policy orders_select_own on orders for select
  using (customer_id = auth.uid() or is_admin());
drop policy if exists orders_insert_via_rpc on orders; -- inserts happen in RPC (security definer)
create policy orders_admin_all on orders for all using (is_admin()) with check (is_admin());
```
**Guest enumeration defense:** tracking requires token+phone, returns no PII (no names/addresses), and the query uses the partial index on `guest_phone`.

## 6. Auth flow
```
signup (email, password, name, phone)
  → supabase.auth.signUp() → auth.users row
  → DB trigger on_auth_user_created → insert profiles(id, full_name, phone)
login → signInWithPassword | signInWithOtp (magic link, email)
reset → resetPasswordForEmail()
admin bootstrap: dashboard → Authentication → user → Edit → app_metadata { role: 'admin' } (one-time)
is_admin() = JWT app_metadata.role OR profiles.is_admin (either source authorizes)
```
Sessions: supabase-js persists in `localStorage`; `onAuthStateChange` drives `/my-orders` gating and admin nav visibility. JWT expiry auto-refresh handled by SDK.

## 7. Guest vs account orders
Guest orders store `guest_name/guest_phone`, `customer_id null`. Later, when the shop registers that phone as a user, an admin can **claim** the guest order: `update orders set customer_id = profiles.id where guest_phone = profiles.phone` (admin action button "গ্রাহককে সংযুক্ত করুন"). Claimed orders appear in `/my-orders`.

## 8. Seed data (`supabase/seed.sql`)
`services.id` স্থির (deterministic): `uuid5(DNS 'shebaghor.services', slug)` — নতুন প্রজেক্টে রি-সিড করলেও পুরনো ব্যাকআপের `service_id` লিঙ্ক অপরিবর্তিত থাকে। পুরনো (random-id) সিড থেকে আসা প্রজেক্টে `on conflict (slug) do update` আইডি বদলায় না।
Current shop rate card (from দলিল সহায়ক, editable later):
B&W প্রিন্ট ৳৩(পেজ) · রঙিন প্রিন্ট ৳১০ · ফটোকপি ৳২ · স্ক্যান ৳১৫ · PDF→ওয়ার্ড ৳২০ · বাংলা টাইপিং ৳৪০ · ইংরেজি টাইপিং ৳৩০ · CV ৳১৫০ · লেমিনেটিং A4 ৳৪০ · লেমিনেটিং কার্ড ৳২০ · স্পাইরাল ৳৬০ · হার্ড বাইন্ডিং ৳১৫০ · পাসপোর্ট ছবি ৳২০ · ভিসা ছবি ৳২৫ · ভিজিটিং কার্ড ৳৬ · বিয়ের কার্ড ৳৩০ · অনলাইন আবেদন ফিলআপ ৳১০০(পেজ) · দলিল প্রস্তুতি ৳২০০ · জন্ম নিবন্ধন আবেদন ৳১৫০ · NID সংশোধন আবেদন ৳১৫০ · ই-টিন ৳২০০ · পুলিশ ক্লিয়ারেন্স ৳২০০ · পাসপোর্ট আবেদন ৳২৫০ · ই-টিকিট ৳১০০ · ভিসা সহযোগিতা ৳৫০০ · ইমেইল/WhatsApp ফাইল ৳২০
(26 services; slugs: bw-print, color-print, photocopy, scan, pdf-to-word, typing-bn, typing-en, cv, laminate-a4, laminate-card, spiral, hardbind, photo-passport, photo-visa, visiting-card, wedding-card, online-form, deed, birth-reg, nid-fix, e-tin, police-clearance, passport, e-ticket, visa-help, file-send)

## 9. Migrations & ops
- Fresh project: `psql $DATABASE_URL -f schema.sql -f policies.sql -f seed.sql` (or SQL editor paste in order).
- Change = new numbered file `supabase/migrations/000N_desc.sql`; never edit applied files.
- Weekly: Export JSON (settings → Export) uploaded to Drive — covers drift beyond SQL.
- Restore drill (verified locally, PG17): fresh scratch DB → schema → policies → seed (deterministic ids) → JSON export shape → wipe → restore via `tools/restore-backup.sql` (local) or `tools/backup-to-sql.py` (hosted SQL editor). Negative guard verified: corrupt or incomplete backup (missing/non-array `tables.orders` or `tables.order_items`, or non-object JSON) aborts with a clear EXCEPTION before any delete — transaction rolled back, psql exits 3; empty table arrays (fresh shop) restore cleanly to 0 rows. The hosted path (`tools/backup-to-sql.py`) performs the same pre-flight validation (missing/non-array `tables.orders`/`tables.order_items`, non-object JSON, corrupt file) and exits 1 before emitting any SQL; `service_id` is uuid-regex-sanitized — malformed/stale/foreign ids degrade to NULL (keeping the item snapshot), and a seed-matching id survives the restore (verified on a scratch DB: stub→schema→policies→seed, PG17). Customer-facing `track_order()` works on restored rows; next token continues from max+1.
- Storage usage watch: 1GB free; NID purge keeps `order-files` small.

## 10. Phase-5 additions (migration `supabase/migration-2026-11-tools.sql`, applied 2026-11-16 via Supabase migration `tools_jobs_work_queue`)
| Table | customer | admin |
|---|---|---|
| `job_posts` | select `where active` (anon ok — public notice board) | all (CRUD) — seekers apply via WhatsApp link (`https://wa.me/88<number>?text=…`), no seeker accounts |
| `work_tasks` | — (no customer access) | all — 5-state board `queued→in_progress→(waiting_customer)→ready→done`, priority 1–3, optional `order_id` (same-day token link) |
RLS: `job_posts` public-select-active + admin-all; `work_tasks` admin-only. Both use `set_updated_at()` trigger. No new enums — status/category as checked text (keeps migration reversible).
**Backup note:** `job_posts`/`work_tasks` are NOT in the JSON backup export (v2 format) — they hold no customer PII at rest except task customer_name/phone; export them manually if needed. `orders` family and `profiles` still cover customer records. (Decision deferred: add to v3 backup when Drive flow is in weekly rotation.)
Catalog: 9 free in-shop tools added to `services` with `base_price = 0` (`tool-*` slugs, sort_order 300–380) — see §8.
