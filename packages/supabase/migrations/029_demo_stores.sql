-- Demo stores for exploring the full customer experience.
-- Usage (SQL editor):   select public.seed_demo_stores(19.8762, 75.3433);   -- your market's lat, lng
-- Remove later:          select public.remove_demo_stores();
-- Demo shopkeepers are placeholder accounts (demo_merchant_N@bever.app) that cannot be signed into.

create or replace function public.seed_demo_stores(p_lat double precision, p_lng double precision)
returns text
language plpgsql security definer set search_path = public, auth, extensions
as $$
declare
  v_shops jsonb := $j$[
   {"n":"Sharma Kirana & General Store","c":"GROCERY","d":"Daily groceries and household essentials","dx":0.0030,"dy":0.0020,"eta":12,
    "cats":["Staples","Oils & Masala","Snacks"],
    "p":[["Toor Dal","1 kg",155,170,"1f33e",0],["Basmati Rice","5 kg",640,720,"1f35a",0],["Aashirvaad Atta","5 kg",245,265,"1f33e",0],["Sunflower Oil","1 L",155,175,"1f6e2",1],["Tata Salt","1 kg",26,28,"1f9c2",1],["Red Chilli Powder","200 g",72,80,"1f336",1],["Lays Chips","52 g",20,20,"1f35f",2],["Dark Chocolate","55 g",85,95,"1f36b",2],["Marie Biscuits","250 g",30,35,"1f36a",2],["Honey","500 g",230,260,"1f36f",1]]},
   {"n":"Fresh Mart Fruits & Vegetables","c":"GROCERY","d":"Farm-fresh fruits and vegetables every morning","dx":-0.0040,"dy":0.0035,"eta":15,
    "cats":["Vegetables","Fruits"],
    "p":[["Tomato","1 kg",40,48,"1f345",0],["Potato","1 kg",30,34,"1f954",0],["Onion","1 kg",35,40,"1f9c5",0],["Carrot","500 g",28,32,"1f955",0],["Broccoli","1 pc",55,65,"1f966",0],["Garlic","250 g",45,55,"1f9c4",0],["Banana","1 dozen",60,70,"1f34c",1],["Apple","1 kg",180,210,"1f34e",1],["Mango","1 kg",140,160,"1f96d",1],["Grapes","500 g",75,90,"1f347",1],["Watermelon","1 pc",90,110,"1f349",1],["Orange","1 kg",85,100,"1f34a",1]]},
   {"n":"Daily Dairy & Bakery","c":"BAKERY","d":"Milk, curd, bread and fresh bakes","dx":0.0055,"dy":-0.0030,"eta":10,
    "cats":["Dairy","Bread & Bakes"],
    "p":[["Full Cream Milk","1 L",68,68,"1f95b",0],["Fresh Curd","400 g",35,40,"1f95b",0],["Paneer","200 g",95,110,"1f9c0",0],["Butter","100 g",58,62,"1f9c8",0],["Eggs","12 pcs",84,96,"1f95a",0],["Brown Bread","400 g",48,55,"1f35e",1],["Croissant","2 pcs",70,80,"1f950",1],["Cheese Slices","200 g",125,140,"1f9c0",0],["Cookies","200 g",90,105,"1f36a",1]]},
   {"n":"Health First Pharmacy","c":"PHARMACY","d":"Medicines, wellness and personal care","dx":-0.0020,"dy":-0.0050,"eta":14,
    "cats":["Medicines","Personal care"],
    "p":[["Paracetamol 500mg","10 tabs",20,22,"1f48a",0],["Cough Syrup","100 ml",95,110,"1f48a",0],["Bandage Strips","20 pcs",45,52,"1fa79",0],["Digital Thermometer","1 pc",190,250,"1f321",0],["Hand Sanitizer","200 ml",85,99,"1f9f4",1],["Bath Soap","3 pack",120,135,"1f9fc",1],["Toothbrush","2 pcs",60,70,"1faa5",1],["Face Wash","100 ml",140,170,"1f9f4",1]]},
   {"n":"Spice Kitchen","c":"RESTAURANT","d":"North Indian meals, rolls and snacks","dx":0.0070,"dy":0.0040,"eta":22,
    "cats":["Meals","Fast food"],
    "p":[["Veg Thali","1 plate",160,180,"1f35b",0],["Paneer Butter Masala","1 plate",190,210,"1f35b",0],["Chicken Biryani","1 plate",220,250,"1f357",0],["Veg Burger","1 pc",90,110,"1f354",1],["French Fries","1 plate",80,95,"1f35f",1],["Paneer Roll","1 pc",110,130,"1f32f",1],["Veg Pizza","8 inch",199,240,"1f355",1],["Noodles","1 plate",120,140,"1f35c",1]]},
   {"n":"Cool Corner Drinks & Ice Cream","c":"GROCERY","d":"Cold drinks, juices, ice creams and tea","dx":-0.0060,"dy":-0.0015,"eta":13,
    "cats":["Drinks","Ice cream"],
    "p":[["Cola","750 ml",40,45,"1f964",0],["Mango Juice","1 L",110,125,"1f9c3",0],["Lemon Soda","250 ml",20,20,"1f964",0],["Green Tea","25 bags",150,175,"1f375",0],["Instant Coffee","50 g",160,185,"2615",0],["Vanilla Ice Cream","500 ml",190,220,"1f366",1],["Chocolate Cone","1 pc",40,45,"1f366",1],["Mineral Water","1 L",20,20,"1f964",0]]},
   {"n":"Tech Point Electronics","c":"ELECTRONICS","d":"Chargers, earphones, bulbs and batteries","dx":0.0025,"dy":0.0065,"eta":18,
    "cats":["Mobile","Home"],
    "p":[["Earphones","1 pc",299,499,"1f3a7",0],["Fast Charger","20 W",549,799,"1f50c",0],["USB Cable","1 m",149,249,"1f50c",0],["Power Bank","10000 mAh",999,1499,"1f50b",0],["LED Bulb","9 W",85,110,"1f4a1",1],["AA Batteries","4 pcs",90,110,"1f50b",1]]},
   {"n":"Paper & Pen Stationery","c":"STATIONERY","d":"Notebooks, pens and school supplies","dx":-0.0035,"dy":0.0070,"eta":16,
    "cats":["Writing","Paper"],
    "p":[["Ball Pens","10 pcs",50,60,"1f58a",0],["Pencils","10 pcs",40,50,"270f",0],["Notebook","200 pages",65,75,"1f4d3",1],["A4 Paper","100 sheets",95,110,"1f4da",1],["Paper Clips","100 pcs",25,30,"1f4ce",0],["Story Book","1 pc",150,199,"1f4da",1]]}
  ]$j$::jsonb;
  v_shop jsonb; v_prod jsonb; v_i integer := 0; v_uid uuid; v_store uuid; v_cat uuid;
  v_cats uuid[]; v_k integer; v_count integer := 0; v_products integer := 0;
  v_email text; v_phone text;
begin
  for v_shop in select * from jsonb_array_elements(v_shops) loop
    v_i := v_i + 1;
    v_email := 'demo_merchant_' || v_i || '@bever.app';
    v_phone := '+91900001000' || v_i;
    select id into v_uid from auth.users where email = v_email;
    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
              crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('full_name', 'Demo shopkeeper ' || v_i, 'phone', v_phone), now(), now());
    end if;
    insert into public.profiles (id, role, full_name, phone, is_active)
    values (v_uid, 'merchant', 'Demo shopkeeper ' || v_i, v_phone, true)
    on conflict (id) do update set role = 'merchant', is_active = true;

    select id into v_store from public.stores where merchant_id = v_uid;
    if v_store is null then
      insert into public.stores (merchant_id, name, description, phone, address_text, location, category,
                                 is_open, is_verified, is_active, estimated_delivery_minutes, minimum_order_amount,
                                 service_radius_meters, average_rating, total_ratings)
      values (v_uid, v_shop->>'n', v_shop->>'d', v_phone, 'Demo market, near your location',
              st_setsrid(st_makepoint(p_lng + (v_shop->>'dy')::double precision, p_lat + (v_shop->>'dx')::double precision), 4326),
              (v_shop->>'c')::public.store_category, true, true, true, (v_shop->>'eta')::integer, 0, 4000,
              round((4.0 + (v_i % 10) / 10.0)::numeric, 2), 20 + v_i * 7)
      returning id into v_store;

      v_cats := '{}'; v_k := 0;
      for v_prod in select * from jsonb_array_elements(v_shop->'cats') loop
        insert into public.product_categories (store_id, name, sort_order) values (v_store, v_prod #>> '{}', v_k) returning id into v_cat;
        v_cats := v_cats || v_cat; v_k := v_k + 1;
      end loop;

      v_k := 0;
      for v_prod in select * from jsonb_array_elements(v_shop->'p') loop
        insert into public.products (store_id, category_id, name, image_url, price, compare_at_price, unit, is_available, is_active, sort_order)
        values (v_store, v_cats[((v_prod->>5)::integer) + 1], v_prod->>0,
                'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/' || (v_prod->>4) || '.png',
                (v_prod->>2)::integer * 100,
                case when (v_prod->>3)::integer > (v_prod->>2)::integer then (v_prod->>3)::integer * 100 else null end,
                v_prod->>1, not (v_k = 4 and v_i = 1), true, v_k);
        v_k := v_k + 1; v_products := v_products + 1;
      end loop;
      v_count := v_count + 1;
    end if;
  end loop;
  return 'Created ' || v_count || ' demo stores with ' || v_products || ' products around ' || p_lat || ', ' || p_lng;
end $$;
revoke all on function public.seed_demo_stores(double precision, double precision) from public, anon, authenticated;

create or replace function public.remove_demo_stores()
returns text
language plpgsql security definer set search_path = public, auth
as $$
declare v_n integer;
begin
  delete from public.stores where merchant_id in (select id from auth.users where email like 'demo\_merchant\_%@bever.app');
  get diagnostics v_n = row_count;
  delete from auth.users where email like 'demo\_merchant\_%@bever.app';
  return 'Removed ' || v_n || ' demo stores';
end $$;
revoke all on function public.remove_demo_stores() from public, anon, authenticated;
