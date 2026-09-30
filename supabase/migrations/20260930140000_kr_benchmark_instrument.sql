-- KR-BENCH-2 step A: add KODEX 코스피 (226490, KRX; Yahoo 226490.KS) as an active KR ETF so the market job collects
-- its prices. It becomes the KR RS benchmark only in step B (*_kr_benchmark_kospi.sql), after its metrics exist.
insert into public.instruments(market,ticker,name,asset_class,exchange,sector,industry,role,benchmark_ticker,currency,active)
values ('KR','226490','KODEX 코스피','ETF','KOSPI','Broad Market','KOSPI','KR Benchmark ETF','226490','KRW',true)
on conflict (market,ticker) do update set active=true,updated_at=now();
