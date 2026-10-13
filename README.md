# Festize

A React, TypeScript, Vite and Tailwind CSS fest-management app. The Explore workspace runs locally without configuration. Cloud mode uses Supabase Auth, Postgres, Row Level Security and Realtime so a fest's staff can use the same fest code and credentials on different devices.

## Cloud Setup

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Create an administrator in Supabase Authentication with your chosen email, and set its password to the access code `SINAN610CM321`. Set that email as `VITE_FESTIZE_ADMIN_EMAIL`.
3. Deploy `supabase/functions/provision-user` to the same project. The function requires the standard server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` secrets. Never put the service-role key in Vite environment variables.
4. Copy `.env.example` to `.env.local` and enter the project's URL, anon key and admin email. Redeploy the frontend with those values.
5. Create fests in the admin area. The main-user passwords are displayed at creation. Share the fest code, username and password securely. Every role uses the same code on the sign-in screen.

Administrator access is reached by typing `SINAN610CM321` into the fest-code bar, which signs you straight in. If that automatic sign-in fails in cloud mode, the password screen appears as a fallback.

The browser only has access to fests allowed by the signed-in Supabase user. All fest data is scoped by `fest_id`, and changes in one fest do not appear in another. Realtime updates refresh other signed-in devices. The database stores no staff passwords in the fest snapshot; Supabase Auth owns those credentials. Existing passwords are shown only during creation in cloud mode.

Without the three `VITE_` settings, the app explicitly enters offline preview mode. Offline-created fests are kept in that browser only and cannot sync across devices. The Explore workspace is a separate local sample with the stated limits.

## Notes

- Staff account creation in cloud mode requires the deployed Edge Function. The fest owner can create main users, and main users can create staff. A team manager may create members only for their team.
- The current JSON snapshot is protected by fest-level RLS; role-specific editing restrictions are applied in the interface. For a production deployment where untrusted staff can call the database directly, move individual mutations into role-checked server functions before giving staff broader edit rights.
- The access code is written into the app source, so it ships inside the published JavaScript bundle and anyone inspecting the build can read it. It hides the admin entrance rather than protecting it. Before a real deployment, keep the password screen as the actual check, or rotate the Supabase admin password and treat the code as a shortcut only for trusted devices.