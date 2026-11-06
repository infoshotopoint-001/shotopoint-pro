-- SPP Have a Story: Supabase schema, row-level security and private media storage
-- Run in Supabase SQL Editor. Review the policies before production use.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'SPP Creator',
  bio text,
  avatar_url text,
  role text not null default 'member' check (role in ('member','admin')),
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_spp_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;

create or replace function public.handle_spp_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'SPP Creator'))
  on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_spp_auth_user_created on auth.users;
create trigger on_spp_auth_user_created after insert on auth.users
for each row execute procedure public.handle_spp_new_user();

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null constraint community_posts_creator_id_fkey references public.profiles(id) on delete cascade,
  category text not null check(category in ('movie-story','live-pitch','novel','novel-video','song','music-video','tutorial')),
  title text not null check(length(title) between 2 and 120),
  summary text not null check(length(summary) between 10 and 1800),
  story_text text,
  genre text,
  creator_credit text,
  external_url text,
  youtube_url text,
  contact_preference text not null default 'comments' check(contact_preference in ('comments','messages','both')),
  media_type text,
  storage_path text,
  cover_path text,
  status text not null default 'pending' check(status in ('pending','published','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null constraint community_comments_user_id_fkey references public.profiles(id) on delete cascade,
  body text not null check(length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint community_messages_no_self_message check(sender_id <> recipient_id)
);

create index if not exists community_posts_public_idx on public.community_posts(status,created_at desc);
create index if not exists community_posts_creator_idx on public.community_posts(creator_id,created_at desc);
create index if not exists community_comments_post_idx on public.community_comments(post_id,created_at);
create index if not exists community_messages_pair_idx on public.community_messages(sender_id,recipient_id,created_at);

alter table public.profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_messages enable row level security;

drop policy if exists "profiles visible to creator and public authors" on public.profiles;
create policy "profiles visible to creator and public authors" on public.profiles for select
using (id=auth.uid() or exists(select 1 from public.community_posts p where p.creator_id=profiles.id and p.status='published') or public.is_spp_admin());
drop policy if exists "creator updates own profile" on public.profiles;
create policy "creator updates own profile" on public.profiles for update
using (id=auth.uid()) with check (id=auth.uid());

-- New posts must be submitted as pending. Only an admin can publish/reject.
drop policy if exists "public sees published posts and owner sees own" on public.community_posts;
create policy "public sees published posts and owner sees own" on public.community_posts for select
using (status='published' or creator_id=auth.uid() or public.is_spp_admin());
drop policy if exists "approved creators submit pending posts" on public.community_posts;
create policy "approved creators submit pending posts" on public.community_posts for insert
with check (creator_id=auth.uid() and status='pending' and exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_approved=true or p.role='admin')));
drop policy if exists "owners edit pending posts and admins moderate" on public.community_posts;
create policy "owners edit pending posts and admins moderate" on public.community_posts for update
using ((creator_id=auth.uid() and status='pending') or public.is_spp_admin())
with check ((creator_id=auth.uid() and status='pending') or public.is_spp_admin());
drop policy if exists "owners delete pending posts and admins delete any" on public.community_posts;
create policy "owners delete pending posts and admins delete any" on public.community_posts for delete
using ((creator_id=auth.uid() and status='pending') or public.is_spp_admin());

drop policy if exists "comments visible on published posts" on public.community_comments;
create policy "comments visible on published posts" on public.community_comments for select
using (exists(select 1 from public.community_posts p where p.id=post_id and p.status='published' and p.contact_preference in ('comments','both')) or public.is_spp_admin());
drop policy if exists "signed-in members comment on published posts" on public.community_comments;
create policy "signed-in members comment on published posts" on public.community_comments for insert
with check (user_id=auth.uid() and exists(select 1 from public.community_posts p where p.id=post_id and p.status='published' and p.contact_preference in ('comments','both')));
drop policy if exists "owners and admins delete comments" on public.community_comments;
create policy "owners and admins delete comments" on public.community_comments for delete
using (user_id=auth.uid() or public.is_spp_admin());

drop policy if exists "participants read own messages" on public.community_messages;
create policy "participants read own messages" on public.community_messages for select
using (sender_id=auth.uid() or recipient_id=auth.uid() or public.is_spp_admin());
drop policy if exists "members send messages to approved creators" on public.community_messages;
create policy "members send messages to approved creators" on public.community_messages for insert
with check (sender_id=auth.uid() and exists(select 1 from public.profiles p where p.id=recipient_id and (p.is_approved=true or p.role='admin')) and exists(select 1 from public.community_posts cp where cp.creator_id=recipient_id and cp.status='published' and cp.contact_preference in ('messages','both')));
drop policy if exists "recipients mark messages read" on public.community_messages;
create policy "recipients mark messages read" on public.community_messages for update
using (recipient_id=auth.uid() or public.is_spp_admin())
with check (recipient_id=auth.uid() or public.is_spp_admin());

-- Grants for browser client. Do not grant service_role credentials to the browser.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update(display_name,bio,avatar_url) on public.profiles to authenticated;
grant select,insert,update,delete on public.community_posts to authenticated;
grant select on public.community_posts to anon;
grant select,insert,delete on public.community_comments to authenticated;
grant select on public.community_comments to anon;
grant select,insert on public.community_messages to authenticated;
grant update(read_at) on public.community_messages to authenticated;

grant select,insert,delete on storage.objects to authenticated;
grant select on storage.objects to anon;

-- Private upload bucket. File limits can also be adjusted in Supabase Storage settings.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('spp-community-media','spp-community-media',false,26214400,array['image/png','image/jpeg','image/webp','application/pdf','audio/mpeg','audio/mp3','video/mp4','video/webm'])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "approved creators upload own community media" on storage.objects;
create policy "approved creators upload own community media" on storage.objects for insert to authenticated
with check(bucket_id='spp-community-media' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p where p.id=auth.uid() and (p.is_approved=true or p.role='admin')));
drop policy if exists "owners and admins read community media" on storage.objects;
create policy "owners and admins read community media" on storage.objects for select to public
using(bucket_id='spp-community-media' and (exists(select 1 from public.community_posts p where (p.storage_path=name or p.cover_path=name) and p.status='published') or (auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text) or public.is_spp_admin()));
drop policy if exists "owners and admins delete community media" on storage.objects;
create policy "owners and admins delete community media" on storage.objects for delete to authenticated
using(bucket_id='spp-community-media' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_spp_admin()));

-- Enable realtime updates for comments and private messages.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_comments') then
    alter publication supabase_realtime add table public.community_comments;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_messages') then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end $$;
