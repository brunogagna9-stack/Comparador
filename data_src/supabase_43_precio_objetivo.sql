-- KyraNoHard · actualización 43: precio objetivo («avisarme cuando baje de $X»).
-- Pegar TODO en Supabase → SQL Editor → New query → Run. Tiene que decir «Success. No rows returned».
-- Se puede correr más de una vez sin problema. No borra ni cambia ningún dato existente.

-- 1) Columna nueva en los seguimientos (vacía = sin precio objetivo)
alter table public.follows add column if not exists target_price numeric;
alter table public.follows drop constraint if exists follows_target_price_check;
alter table public.follows add constraint follows_target_price_check check (target_price is null or (target_price > 0 and target_price < 1e12));

-- 2) La consulta que usa el envío de avisos ahora también devuelve el precio objetivo
drop function if exists public.notify_targets();
create function public.notify_targets() returns table (
  user_id uuid, email text, notify_down boolean, notify_up boolean, notify_cuotas boolean,
  product_id text, name text, price_ref numeric, last_price numeric, last_cuotas boolean, target_price numeric)
language sql security definer set search_path = '' as $$
  select f.user_id, u.email::text, coalesce(p.notify_down, true), coalesce(p.notify_up, false), coalesce(p.notify_cuotas, true),
         f.product_id, f.name, f.price_ref, f.last_price, f.last_cuotas, f.target_price
  from public.follows f
  join auth.users u on u.id = f.user_id
  left join public.profiles p on p.user_id = f.user_id
  where u.email_confirmed_at is not null and u.deleted_at is null
$$;
revoke all on function public.notify_targets() from public, anon, authenticated;
grant execute on function public.notify_targets() to service_role;
