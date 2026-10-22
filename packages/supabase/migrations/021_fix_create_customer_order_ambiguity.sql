-- BEVER migration 021: FIX create_customer_order (found by the live end-to-end test)
--
-- The live function fails for every customer with
--   42702: column reference "order_number" is ambiguous
-- because the function's OUT column "order_number" collides with the orders.order_number
-- column in "returning id, order_number". Result: NO customer could place an order.
--
-- Fix: alias the table in the INSERT, qualify the RETURNING columns, and tell plpgsql to
-- prefer columns on any other clash. Business rules are unchanged from migration 018.
-- Safe to run more than once. Run in the Supabase SQL editor.

create or replace function public.create_customer_order(
  p_store_id uuid,
  p_delivery_address_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method default 'COD',
  p_special_instructions text default null
)
returns table(order_id uuid, order_number text, items_total integer, delivery_fee integer, total_amount integer)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_customer_id uuid := (select auth.uid());
  v_store record;
  v_address record;
  v_items_total integer := 0;
  v_delivery_fee integer := 0;
  v_total integer := 0;
  v_order_id uuid;
  v_order_number text;
  v_delivery_otp text;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_distance_meters double precision;
begin
  if v_customer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_payment_method <> 'COD' then raise exception 'PAYMENT_METHOD_NOT_SUPPORTED'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'CART_EMPTY'; end if;

  select id,name,is_active,is_verified,is_open,minimum_order_amount,service_radius_meters,location into v_store
  from public.stores where id = p_store_id;
  if not found or not v_store.is_active or not v_store.is_verified or not v_store.is_open then raise exception 'STORE_UNAVAILABLE'; end if;

  select id,customer_id,label,address_line_1,address_line_2,city,state,pincode,location into v_address
  from public.customer_addresses where id = p_delivery_address_id and customer_id = v_customer_id;
  if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
  if v_address.location is null then raise exception 'ADDRESS_LOCATION_REQUIRED'; end if;
  if v_store.location is null or v_store.service_radius_meters is null then raise exception 'STORE_LOCATION_UNAVAILABLE'; end if;

  v_distance_meters := public.ST_Distance(v_store.location::public.geography,v_address.location::public.geography);
  if v_distance_meters > v_store.service_radius_meters then raise exception 'ADDRESS_OUTSIDE_SERVICE_AREA'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'product_id') or not (v_item ? 'quantity') then raise exception 'INVALID_CART_ITEM'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception 'INVALID_QUANTITY'; end if;

    select id,store_id,name,image_url,unit,price,is_available,is_active into v_product
    from public.products where id = (v_item->>'product_id')::uuid and store_id = p_store_id;
    if not found or not v_product.is_active or not v_product.is_available then raise exception 'PRODUCT_UNAVAILABLE:%',(v_item->>'product_id'); end if;
    v_items_total := v_items_total + (v_product.price * v_qty);
  end loop;

  if v_items_total < (v_store.minimum_order_amount * 100) then raise exception 'MINIMUM_ORDER_NOT_MET'; end if;
  if v_items_total < 19900 then v_delivery_fee := 2000 + (ceil(v_distance_meters / 1000.0)::integer * 700); end if;
  v_total := v_items_total + v_delivery_fee;
  v_delivery_otp := lpad((floor(random() * 10000))::integer::text,4,'0');

  insert into public.orders as o
    (customer_id,store_id,status,payment_method,payment_status,delivery_address_id,delivery_address_snapshot,
     items_total,delivery_fee,discount_amount,total_amount,special_instructions,delivery_otp)
  values
    (v_customer_id,p_store_id,'PENDING','COD','PENDING',p_delivery_address_id,
     jsonb_build_object('label',v_address.label,'address_line_1',v_address.address_line_1,'address_line_2',v_address.address_line_2,
       'city',v_address.city,'state',v_address.state,'pincode',v_address.pincode,'location',v_address.location::text),
     v_items_total,v_delivery_fee,0,v_total,nullif(trim(p_special_instructions),''),v_delivery_otp)
  returning o.id, o.order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select id,name,image_url,unit,price into v_product
    from public.products where id=(v_item->>'product_id')::uuid and store_id=p_store_id and is_active=true and is_available=true;
    insert into public.order_items
      (order_id,product_id,product_name_snapshot,product_image_snapshot,unit_price,quantity,total_price,unit_snapshot)
    values
      (v_order_id,v_product.id,v_product.name,v_product.image_url,v_product.price,v_qty,v_product.price*v_qty,v_product.unit);
  end loop;

  return query select v_order_id,v_order_number,v_items_total,v_delivery_fee,v_total;
end;
$function$;

revoke execute on function public.create_customer_order(uuid,uuid,jsonb,public.payment_method,text) from public, anon;
grant execute on function public.create_customer_order(uuid,uuid,jsonb,public.payment_method,text) to authenticated;
