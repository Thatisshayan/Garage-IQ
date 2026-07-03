-- Stop auto-granting the "staff" role to every new signup.
-- Public signup previously gave any account (email/password or Google OAuth)
-- immediate staff access to the app, including paid AI endpoints. New accounts
-- now get no role by default; an admin must grant one via the dashboard or an
-- in-app invite flow. The first-ever user still auto-becomes admin, preserving
-- the initial bootstrap path.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
