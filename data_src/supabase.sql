-- KyraNoHard · cuentas de usuario (actualización 32)
-- Pegá TODO este archivo en Supabase → SQL Editor → «New query» → «Run». Se puede correr más de una vez sin romper nada.
-- Seguridad: cada persona solo puede leer y modificar SUS filas (Row Level Security). La clave «publishable» que va en
-- la web no puede saltear estas reglas; la clave «secret» (solo en los secretos de GitHub) se usa para enviar los avisos.

-- 1) Preferencias de avisos (una fila por cuenta)
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  notify_down  boolean not null default true,    -- avisar si baja de precio
  notify_up    boolean not null default false,   -- avisar si sube de precio
  notify_cuotas boolean not null default true,   -- avisar si aparece en cuotas sin interés
  created_at   timestamptz not null default now()
);

-- 2) Productos en seguimiento
create table if not exists public.follows (
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  text not null check (char_length(product_id) between 1 and 200),
  name        text check (char_length(name) <= 300),
  price_ref   numeric,                 -- precio cuando lo empezó a seguir
  last_price  numeric,                 -- último precio con el que se comparó (lo actualiza el envío de avisos)
  last_cuotas boolean,                 -- si la última vez tenía cuotas sin interés
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- 3) Historial de armados y comparaciones
create table if not exists public.history (
  user_id  uuid not null references auth.users(id) on delete cascade,
  id       text not null check (char_length(id) between 1 and 60),
  kind     text not null check (kind in ('armados','comparaciones')),
  title    text check (char_length(title) <= 300),
  sub      text check (char_length(sub) <= 300),
  url      text not null check (char_length(url) <= 2000),
  cat      text check (char_length(cat) <= 60),
  t        timestamptz not null default now(),
  primary key (user_id, id)
);

-- 4) Registro de avisos enviados (solo lo usa el envío automático)
create table if not exists public.notifications_log (
  id       bigserial primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  sent_at  timestamptz not null default now(),
  items    jsonb
);

-- Límites para que nadie llene la base: 300 seguimientos y 100 entradas de historial por cuenta
create or replace function public.ct_limit() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'follows' and (select count(*) from public.follows where user_id = new.user_id) >= 300 then
    raise exception 'Límite de 300 productos en seguimiento';
  end if;
  if tg_table_name = 'history' and (select count(*) from public.history where user_id = new.user_id) >= 100 then
    raise exception 'Límite de 100 entradas de historial';
  end if;
  return new;
end $$;
drop trigger if exists follows_limit on public.follows;
create trigger follows_limit before insert on public.follows for each row execute function public.ct_limit();
drop trigger if exists history_limit on public.history;
create trigger history_limit before insert on public.history for each row execute function public.ct_limit();

-- Row Level Security: activada en todas las tablas
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.history enable row level security;
alter table public.notifications_log enable row level security;   -- sin políticas: nadie desde la web la puede leer

drop policy if exists "propio perfil" on public.profiles;
create policy "propio perfil" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "propios seguimientos" on public.follows;
create policy "propios seguimientos" on public.follows for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "propio historial" on public.history;
create policy "propio historial" on public.history for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Permisos mínimos: los visitantes sin cuenta (anon) no tocan nada
revoke all on public.profiles, public.follows, public.history, public.notifications_log from anon;
grant select, insert, update, delete on public.profiles, public.follows, public.history to authenticated;
grant all on public.profiles, public.follows, public.history, public.notifications_log to service_role;
grant usage, select on sequence public.notifications_log_id_seq to service_role;

-- Eliminar la cuenta: la persona borra su propio usuario (y, en cascada, todos sus datos)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Para el envío de avisos (solo con la clave secret): seguimientos + preferencias + mail confirmado
create or replace function public.notify_targets() returns table (
  user_id uuid, email text, notify_down boolean, notify_up boolean, notify_cuotas boolean,
  product_id text, name text, price_ref numeric, last_price numeric, last_cuotas boolean)
language sql security definer set search_path = '' as $$
  select f.user_id, u.email::text, coalesce(p.notify_down, true), coalesce(p.notify_up, false), coalesce(p.notify_cuotas, true),
         f.product_id, f.name, f.price_ref, f.last_price, f.last_cuotas
  from public.follows f
  join auth.users u on u.id = f.user_id
  left join public.profiles p on p.user_id = f.user_id
  where u.email_confirmed_at is not null and u.deleted_at is null
$$;
revoke all on function public.notify_targets() from public, anon, authenticated;
grant execute on function public.notify_targets() to service_role;
