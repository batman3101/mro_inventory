-- Self sign-up with administrator approval (decided 2026-11-27).
--
-- A new Supabase Auth account created through the sign-up page gets an app
-- profile that is INACTIVE with role 'viewer'. Inactive users pass no RLS
-- check, so they see nothing until a system_admin activates them on the Users
-- page and sets their role and factory.
--
-- The trigger fires for every new auth account, including ones created by
-- /api/users (GoTrue writes app_metadata after the INSERT, so it cannot be used
-- to tell them apart). /api/users therefore upserts on auth_user_id and turns
-- this pending row into the real profile.
-- PRECONDITION: deploy that /api/users version first; the older one inserts
-- and would fail on the duplicate email.

CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base TEXT;
  v_username TEXT;
  v_suffix INT := 0;
BEGIN
  -- Never attach a self sign-up to an existing profile: that would hand the
  -- existing account (role, factory) to whoever registered the email.
  IF EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = lower(NEW.email)) THEN
    RETURN NEW;
  END IF;

  v_base := left(regexp_replace(split_part(NEW.email, '@', 1), '[^A-Za-z0-9._-]', '', 'g'), 40);
  IF v_base = '' THEN
    v_base := 'user';
  END IF;
  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM public.users u WHERE u.username = v_username) LOOP
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix;
  END LOOP;

  INSERT INTO public.users (
    username, full_name, email, role, location_id, is_active, auth_user_id, phone_number
  ) VALUES (
    v_username,
    left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), v_username), 100),
    NEW.email,
    'viewer',
    NULL,
    FALSE,
    NEW.id,
    ''
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();
