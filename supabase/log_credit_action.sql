-- RPC to log credit-related actions into public.logs
-- Usage: select public.log_credit_action(user_name := 'u', action := 'CREATE_CREDIT', client_name := 'C', product_name := 'P', qty := 1, price := 100, amount := 100, bosh_toluv := 0, currency := 'UZS', detail := '...');

create or replace function public.log_credit_action(
  p_user_name text,
  p_action text,
  p_client_name text,
  p_product_name text,
  p_qty numeric,
  p_price numeric,
  p_amount numeric,
  p_bosh_toluv numeric,
  p_currency text,
  p_detail text
) returns void as $$
begin
  insert into public.logs(
    date, time, ts, user_name, action, kind, product_name, qty, unit_price, amount, bosh_toluv, currency, detail, created_at, updated_at
  ) values (
    current_date,
    to_char(now(), 'HH24:MI:SS'),
    extract(epoch from now())::bigint,
    p_user_name,
    p_action,
    'credit',
    p_product_name,
    p_qty,
    p_price,
    p_amount,
    p_bosh_toluv,
    p_currency,
    p_detail,
    now(),
    now()
  );
end;
$$ language plpgsql security definer;

comment on function public.log_credit_action(text,text,text,text,numeric,numeric,numeric,numeric,text,text) is 'Insert a credit-related row into public.logs (kind=credit)';
