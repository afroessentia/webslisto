alter table public.leads
  add column if not exists first_contacted_at timestamptz,
  add column if not exists replied_at timestamptz,
  add column if not exists reply_type text,
  add column if not exists proposal_sent_at timestamptz,
  add column if not exists loss_reason text;

alter table public.leads drop constraint if exists leads_reply_type_chk;
alter table public.leads add constraint leads_reply_type_chk
  check (reply_type is null or reply_type in ('humano','ia'));

alter table public.leads drop constraint if exists leads_loss_reason_chk;
alter table public.leads add constraint leads_loss_reason_chk
  check (loss_reason is null or loss_reason in ('no_interesa','ya_tiene_web','negocio_cerrado','solo_ia','precio','otro'));

create index if not exists leads_first_contacted_idx on public.leads(first_contacted_at);
create index if not exists leads_replied_idx on public.leads(replied_at);

create or replace function public.set_first_contacted()
returns trigger language plpgsql as $$
begin
  if new.event_type = 'whatsapp_click' then
    update public.leads
       set first_contacted_at = new.created_at
     where id = new.lead_id and first_contacted_at is null;
  end if;
  return new;
end $$;

drop trigger if exists trg_lead_events_first_contact on public.lead_events;
create trigger trg_lead_events_first_contact
after insert on public.lead_events
for each row execute function public.set_first_contacted();

update public.leads l
   set first_contacted_at = fc.first_at
  from (
     select lead_id, min(created_at) as first_at
    from public.lead_events
    where event_type = 'whatsapp_click'
    group by lead_id
  ) fc
 where fc.lead_id = l.id and l.first_contacted_at is null;

create or replace function public.funnel_metrics(
  p_from date,
  p_to date,
  p_niche lead_niche default null
)
returns table (
  contacted bigint,
  replied bigint,
  replied_human bigint,
  replied_ai bigint,
  demos bigint,
  proposals bigint,
  won bigint,
  lost bigint,
  lost_no_interesa bigint,
  lost_ya_tiene_web bigint,
  lost_negocio_cerrado bigint,
  lost_solo_ia bigint,
  lost_precio bigint,
  lost_otro bigint,
  lost_sin_motivo bigint
)
language sql
stable
as $$
  with cohort as (
    select l.*
    from public.leads l
    where l.first_contacted_at is not null
      and (l.first_contacted_at at time zone 'Europe/Madrid')::date between p_from and p_to
      and (p_niche is null or l.niche = p_niche)
  ),
  demo as (
     select distinct lead_id from public.lead_events
    where event_type = 'status_change' and to_status = 'demo_enviada'
  ),
  won_ev as (
    select distinct lead_id from public.lead_events
    where event_type = 'status_change' and to_status = 'ganado'
  )
  select
    count(*),
    count(*) filter (where c.replied_at is not null),
    count(*) filter (where c.replied_at is not null and c.reply_type = 'humano'),
    count(*) filter (where c.replied_at is not null and c.reply_type = 'ia'),
    count(*) filter (where c.id in (select lead_id from demo)),
    count(*) filter (where c.proposal_sent_at is not null),
    count(*) filter (where c.id in (select lead_id from won_ev)),
    count(*) filter (where c.status in ('descartado','no_contactar')),
    count(*) filter (where c.status in ('descartado','no_contactar') and c.loss_reason = 'no_interesa'),
    count(*) filter (where c.status in ('descartado','no_contactar') and c.loss_reason = 'ya_tiene_web'),
    count(*) filter (where c.status in ('descartado','no_contactar') and c.loss_reason = 'negocio_cerrado'),
    count(*) filter (where c.status in ('descartado','no_contactar') and c.loss_reason = 'solo_ia'),
    count(*) filter (where c.status in ('descartado','no_contactar') and c.loss_reason = 'precio'),
    count(*) filter (where c.status in ('descartado','no_contactar') and c.loss_reason = 'otro'),
    count(*) filter (where c.status in ('descartado','no_contactar') and c.loss_reason is null)
  from cohort c;
$$;

grant execute on function public.funnel_metrics(date, date, lead_niche) to authenticated;