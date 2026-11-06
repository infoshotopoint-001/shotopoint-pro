# SPP Have a Story — Creator Showcase

A black-and-gold community showcase for Shoto Point Production. The package includes:

- `HaveAStory.html` — main showcase, filters, search, registration/sign-in, submission, comments and direct-message UI.
- `spp-community.css` — responsive SPP styling.
- `spp-community.js` — Supabase Auth, published feed, private uploads, comments and realtime direct messages.
- `spp-community-config.js` — public Supabase URL/key configuration placeholders.
- `supabase-schema.sql` — profiles, submissions, moderation, comments, messages, private storage policies and realtime publication setup.

## Important status

The UI is built, but the live community service is **not connected until a Supabase project is configured and the SQL is installed**. Without configuration the page shows six clearly labelled demonstration cards. These are examples, not actual SPP member submissions. The sample cards cannot accept real comments, messages or uploads.

## Installation

1. Copy `HaveAStory.html`, `spp-community.css`, `spp-community.js` and `spp-community-config.js` into the root of the existing SPP static website, alongside `index.html`.
2. Create a Supabase project.
3. Open Supabase SQL Editor and run the complete `supabase-schema.sql` file.
4. In Supabase Authentication, configure the site URL and allowed redirect URLs for your local and production domains. Enable email confirmation as desired.
5. Edit `spp-community-config.js`:

```js
window.SPP_COMMUNITY_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY",
  demoMode: false
};
```

Use only the public anon/publishable key in this file. **Never put the Supabase `service_role` key in browser code.**

6. First create an account for the SPP administrator. Confirm the email if email confirmation is enabled. In Supabase SQL Editor, promote that account:

```sql
update public.profiles
set role = 'admin', is_approved = true
where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');
```

7. Sign in as the SPP administrator. Review new member accounts in `profiles`. Set `is_approved = true` for members you approve. Review submitted work in `community_posts`; change `status` from `pending` to `published` or `rejected` after review.
8. Update the existing `index.html` menu link for “Have a Story” to `HaveAStory.html`.
9. Deploy the static site. Supabase handles authentication, database, private storage and realtime; this page does not require an Express server or a Vercel `/api` function.

## Workflow and permissions

- Visitors can browse published showcases.
- A visitor creates an account and confirms their email according to your Supabase Auth configuration.
- New profiles are unapproved by default. An SPP administrator approves creator accounts by setting `is_approved = true`.
- Approved creators may submit movie story ideas, live pitches, novels, novel videos, songs/MP3, music videos/MP4 and tutorials.
- Every submitted post starts with `status = 'pending'`. It is not publicly listed until an admin changes it to `published`.
- Signed-in members can comment on published submissions. Direct messages are stored in `community_messages` and delivered through Supabase Realtime.
- The upload bucket is private. The prototype accepts cover images up to 5 MB and one attachment up to 25 MB. Larger video/audio uploads should be upgraded to resumable uploads (TUS) and an appropriate storage plan.

## Admin operations

The starter UI does not yet include a full visual moderation dashboard. For the first release, approvals are managed in Supabase Table Editor:

- `profiles`: set `is_approved` true for approved creators; keep ordinary members as `role = 'member'`.
- `community_posts`: set `status = 'published'` to publish; use `rejected` to decline.

A future SPP Admin Control Centre module can expose these actions through a role-protected moderation interface.

## Production security checklist

- Review the SQL and RLS policies in a staging Supabase project before public launch.
- Configure Supabase Auth email templates, rate limits, CAPTCHA/abuse protections and password reset URLs.
- Add moderation/reporting tools, block/mute controls, comment rate limiting and a community code of conduct before enabling open messaging publicly.
- Set storage quotas, retention rules and a formal maximum upload size. Use resumable uploads for large media.
- Add virus/content scanning for uploaded documents and media where appropriate.
- Review copyright/consent declarations and a takedown process. Accept only work the submitter owns or is authorised to share.
- Use a verified domain, HTTPS, backups and monitored database quotas.
- Do not expose Supabase service-role keys, database passwords or other secrets in this static site.

## Notes

This is a starter community implementation, not a deployed live service. The page currently shows demo preview cards when `demoMode` is enabled or credentials are absent. Actual member posts, comments, authentication, private media and realtime messaging begin only after Supabase is configured and the schema is installed.
