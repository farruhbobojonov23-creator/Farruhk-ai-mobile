alter table public.fk_username_accounts drop constraint fk_username_accounts_request_id_fkey,
 add constraint fk_username_accounts_request_id_fkey foreign key (request_id)
 references public.fk_access_requests(id) on delete restrict;
