create table public.fk_confirmed_sales (
 request_id uuid primary key references public.fk_access_requests(id) on delete restrict,
 confirmed_at timestamptz not null default now()
);
alter table public.fk_confirmed_sales enable row level security;
revoke all on public.fk_confirmed_sales from public, anon, authenticated;
grant select, insert on public.fk_confirmed_sales to authenticated;
create policy fk_owner_sales_read on public.fk_confirmed_sales for select to authenticated
 using (exists (select 1 from public.fk_admins where user_id = (select auth.uid())));
create policy fk_owner_sales_confirm on public.fk_confirmed_sales for insert to authenticated
 with check (exists (select 1 from public.fk_admins where user_id = (select auth.uid()))
 and exists (select 1 from public.fk_access_requests r where r.id=request_id
 and r.package_code in ('start','pro','premium') and r.buyer_user_id is null and r.status <> 'dismissed'));

alter table public.fk_recipes add column pdf_pending_since timestamptz,
 add column pdf_published_at timestamptz;
create function public.fk_recipe_pdf_changed() returns trigger language plpgsql
 set search_path='' as $$
begin
 new.pdf_pending_since := clock_timestamp();
 return new;
end $$;
create trigger fk_recipe_pdf_change before update of title, category, yield_g,
 shelf_life_minutes, storage_conditions, notes on public.fk_recipes
 for each row when (old.* is distinct from new.*) execute function public.fk_recipe_pdf_changed();
create function public.fk_lines_pdf_changed() returns trigger language plpgsql
 set search_path='' as $$
begin
 if tg_op <> 'INSERT' then
  update public.fk_recipes set pdf_pending_since=clock_timestamp() where id=old.recipe_id;
 end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and new.recipe_id is distinct from old.recipe_id) then
  update public.fk_recipes set pdf_pending_since=clock_timestamp() where id=new.recipe_id;
 end if;
 return null;
end $$;
create trigger fk_ingredients_pdf_change after insert or update or delete on public.fk_ingredients
 for each row execute function public.fk_lines_pdf_changed();
create trigger fk_steps_pdf_change after insert or update or delete on public.fk_steps
 for each row execute function public.fk_lines_pdf_changed();
alter table public.fk_site_settings drop constraint fk_site_settings_key_check,
 add constraint fk_site_settings_key_check check (key in ('hero_title','hero_subtitle','price_start','price_pro','price_premium','premium_materials','premium_services'));
