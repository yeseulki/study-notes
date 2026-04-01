-- ============================================================
-- Run this in Supabase > SQL Editor
-- ============================================================

-- 1. notes table
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  subject     text        not null,
  type        text        not null default 'exam',
  unit_name   text        not null,
  hashtags    text[]      not null default '{}',
  image_urls  text[]      not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at
  before update on public.notes
  for each row execute function update_updated_at();

-- 2. schedules table  (types = text array, supports 복수 선택)
create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  subject     text        not null,
  type        text        not null default 'exam',
  types       text[]      not null default '{}',
  title       text        not null,
  exam_date   date        not null,
  description text,
  created_at  timestamptz not null default now()
);

-- 3. memos table
create table if not exists public.memos (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  content     text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists memos_updated_at on public.memos;
create trigger memos_updated_at
  before update on public.memos
  for each row execute function update_updated_at();

-- 4. Row Level Security (RLS)
alter table public.notes     enable row level security;
alter table public.schedules enable row level security;
alter table public.memos     enable row level security;

-- Allow everyone to read
create policy "Public read notes"
  on public.notes for select using (true);

create policy "Public read schedules"
  on public.schedules for select using (true);

create policy "Public read memos"
  on public.memos for select using (true);

-- Allow anon to insert/update/delete
create policy "Anon write notes"
  on public.notes for all using (true) with check (true);

create policy "Anon write schedules"
  on public.schedules for all using (true) with check (true);

create policy "Anon write memos"
  on public.memos for all using (true) with check (true);

-- ============================================================
-- 5. Storage bucket
-- ============================================================
-- Go to Supabase Dashboard > Storage > New Bucket
--   Name: note-images
--   Public: YES  ✓
--
-- Then add a Storage Policy:
--   Bucket: note-images
--   Operation: SELECT  → Allow (public read)
--   Operation: INSERT  → Allow (anon)
--   Operation: DELETE  → Allow (anon)
-- ============================================================

-- ============================================================
-- MIGRATION  (기존 DB에 이미 테이블이 있는 경우 실행)
-- ============================================================

-- notes: hashtags 컬럼 추가 & type 컬럼 기본값 설정
alter table public.notes
  add column if not exists hashtags text[] not null default '{}';

alter table public.notes
  alter column type set default 'exam';

-- schedules: types 배열 컬럼 추가 & type 컬럼 기본값 설정
alter table public.schedules
  add column if not exists types text[] not null default '{}';

alter table public.schedules
  alter column type set default 'exam';

-- 기존 schedules의 type 값을 types 배열로 마이그레이션
update public.schedules
set types = ARRAY[
  case type
    when 'exam'        then '지필평가'
    when 'performance' then '수행평가'
    else type
  end
]
where array_length(types, 1) is null
   or array_length(types, 1) = 0;

-- memos 테이블 생성 (중복 실행 안전)
create table if not exists public.memos (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  content     text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- memos RLS
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'memos' and policyname = 'Public read memos'
  ) then
    alter table public.memos enable row level security;
    create policy "Public read memos"  on public.memos for select using (true);
    create policy "Anon write memos"   on public.memos for all    using (true) with check (true);
  end if;
end $$;
