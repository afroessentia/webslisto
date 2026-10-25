-- =========================================================
-- WEBLISTO CRM - FASE 1
-- =========================================================
create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
do $$ begin
  create type lead_niche as enum ('reformas','belleza_estetica','otros');
exception when duplicate_object then null; end $$;

do $$ begin
  create type website_status_t as enum ('sin_web','solo_redes_sociales','web_antigua_wordpress','web_operativa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status_t as enum ('nuevo','calificado','demo_enviada','en_conversacion','ganado','descartado','no_contactar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type copy_t as enum ('demo_gratis','oferta_directa_79');
exception when duplicate_object then null; end $$;

-- ---------- FUNCOES AUXILIARES ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Normaliza telefone espanhol para formato +34XXXXXXXXX (ou null)
create or replace function public.normalize_es_phone(raw text)
returns text language plpgsql immutable as $$
declare d text;
begin
  if raw is null then return null; end if;
  d := regexp_replace(raw, '[^0-9]', '', 'g');
  if d like '0034%' then d := substr(d, 5); end if;
  if length(d) = 11 and d like '34%' then d := substr(d, 3); end if;
  if length(d) = 9 then return '+34' || d; end if;
  return null;
end $$;

-- Classifica web pela URL
create or replace function public.classify_website(url text)
returns website_status_t language plpgsql immutable as $$
declare u text;
begin
  if url is null or btrim(url) = '' then return 'sin_web'; end if;
  u := lower(url);
  if u ~ '(instagram\.com|facebook\.com|fb\.com|fb\.me|linktr\.ee|linktree|tiktok\.com|wa\.me|whatsapp\.com|beacons\.ai|taplink|wixsite\.com|business\.site|google\.com/maps|goo\.gl)' then
    return 'solo_redes_sociales';
  end if;
  return 'web_operativa';
end $$;

-- ---------- TABELA LEADS ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null,
  niche lead_niche not null default 'otros',
  subcategory text,
  city text,
  address text,

  phone text,
  whatsapp_number text,
  is_mobile boolean not null default false,

  website_status website_status_t not null default 'sin_web',
  original_url text,
  instagram_handle text,

  google_place_id text,
  google_rating numeric(2,1),
  google_reviews_count integer,
  source text not null default 'manual',        -- manual | csv | apify | outscraper
  import_batch text,

  status lead_status_t not null default 'nuevo',
  selected_copy copy_t,
  last_contact_date date,
  follow_up_date date,
  notes text,

  dedupe_key text
);

create unique index if not exists leads_owner_dedupe_uidx on public.leads(owner_id, dedupe_key);
create index if not exists leads_niche_idx on public.leads(niche);
create index if not exists leads_city_idx on public.leads(city);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_web_idx on public.leads(website_status);
create index if not exists leads_mobile_idx on public.leads(is_mobile);

-- Trigger principal: higieniza, classifica, calcula dedupe_key, data de contacto
create or replace function public.leads_before_write()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();

  new.whatsapp_number := public.normalize_es_phone(new.phone);
  new.is_mobile := coalesce(new.whatsapp_number ~ '^\+34[67][0-9]{8}$', false);

  if tg_op = 'INSERT' then
    if new.original_url is not null and btrim(new.original_url) <> '' then
      new.website_status := public.classify_website(new.original_url);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.original_url is distinct from old.original_url
       and new.website_status is not distinct from old.website_status then
      new.website_status := public.classify_website(new.original_url);
    end if;
  end if;

  if new.instagram_handle is null and new.original_url ilike '%instagram.com%' then
    new.instagram_handle := new.original_url;
  end if;

  new.dedupe_key := coalesce(
    nullif(new.google_place_id, ''),
    new.whatsapp_number,
    lower(btrim(new.name)) || '|' || lower(btrim(coalesce(new.city, '')))
  );

  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('demo_enviada','en_conversacion') then
    new.last_contact_date := current_date;
  end if;

  return new;
end $$;

drop trigger if exists trg_leads_before_write on public.leads;
create trigger trg_leads_before_write
before insert or update on public.leads
for each row execute function public.leads_before_write();

-- ---------- HISTORICO DO FUNIL ----------
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_type text not null,                      -- status_change | whatsapp_click | note
  from_status lead_status_t,
  to_status lead_status_t,
  copy copy_t,
  detail text
);
create index if not exists lead_events_lead_idx on public.lead_events(lead_id, created_at desc);

create or replace function public.leads_log_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_events(owner_id, lead_id, event_type, from_status, to_status)
    values (new.owner_id, new.id, 'status_change', old.status, new.status);
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_log_status on public.leads;
create trigger trg_leads_log_status
after update on public.leads
for each row execute function public.leads_log_status();

-- ---------- TEMPLATES DE MENSAGEM ----------
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key copy_t not null,
  title text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);

drop trigger if exists trg_templates_updated on public.message_templates;
create trigger trg_templates_updated
before update on public.message_templates
for each row execute function public.set_updated_at();

-- Cria templates padrao para o usuario logado (o app chama no primeiro acesso)
create or replace function public.ensure_default_templates()
returns void language plpgsql as $$
begin
  insert into public.message_templates(owner_id, key, title, body) values
  (auth.uid(), 'demo_gratis', 'Demo gratuita',
E'Hola, ¿qué tal? Soy Carine, de WebListo. He visto {nombre_negocio} en Google Maps ({ciudad}) y he notado que todavía no tenéis una web propia.\n\nOs he preparado una demo gratuita de cómo podría quedar vuestra web, sin ningún compromiso. ¿Te la envío por aquí?\n\nSi prefieres que no te escriba más, dímelo y no vuelvo a molestar. ¡Gracias!'),
  (auth.uid(), 'oferta_directa_79', 'Oferta directa 79 €',
E'Hola, ¿qué tal? Soy Carine, de WebListo. He visto {nombre_negocio} en Google Maps ({ciudad}) y quería ofreceros algo concreto: una web profesional para vuestro negocio, lista en 48 horas, por 79 €. Incluye botón de WhatsApp, vuestras fotos y vuestra ubicación en Google Maps.\n\n¿Os interesa que os cuente cómo funciona?\n\nSi prefieres que no te escriba más, dímelo y no vuelvo a molestar. ¡Gracias!')
  on conflict (owner_id, key) do nothing;
end $$;

-- ---------- VIEW DE METRICAS ----------
create or replace view public.lead_metrics
with (security_invoker = true) as
select
  count(*)                                                        as total_leads,
  count(*) filter (where website_status = 'sin_web')              as leads_sin_web,
  count(*) filter (where status = 'demo_enviada')                 as demos_enviadas,
  count(*) filter (where status = 'ganado')                       as ganados
from public.leads;

-- ---------- RLS ----------
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.message_templates enable row level security;

drop policy if exists leads_owner_all on public.leads;
create policy leads_owner_all on public.leads
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists events_owner_all on public.lead_events;
create policy events_owner_all on public.lead_events
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists templates_owner_all on public.message_templates;
create policy templates_owner_all on public.message_templates
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select on public.lead_metrics to authenticated;
