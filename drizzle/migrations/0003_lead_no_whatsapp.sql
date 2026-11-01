alter table public.leads add column if not exists no_whatsapp_at timestamptz;
alter table public.leads drop constraint if exists leads_loss_reason_chk;
alter table public.leads add constraint leads_loss_reason_chk
  check (loss_reason is null or loss_reason in ('no_interesa','ya_tiene_web','negocio_cerrado','solo_ia','precio','otro','sin_whatsapp'));
create index if not exists leads_no_whatsapp_idx on public.leads(no_whatsapp_at);