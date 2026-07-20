create or replace function public.normalize_market_text(input text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(regexp_replace(
    translate(lower(coalesce(input, '')), 'أإآةى', 'اااهي'),
    '[^[:alnum:]]+', ' ', 'g'
  ));
$$;
