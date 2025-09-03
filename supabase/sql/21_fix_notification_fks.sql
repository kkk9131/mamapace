-- Align notification-related FKs with app's user model (public.user_profiles)
-- This avoids FK違反 when the app uses user_profiles.id as user identifier.

-- notifications.user_id -> public.user_profiles(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
      AND table_schema = 'public' 
      AND table_name = 'notifications' 
      AND constraint_name = 'notifications_user_id_fkey'
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_user_id_fkey;
  END IF;
END$$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- notification_preferences.user_id -> public.user_profiles(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
      AND table_schema = 'public' 
      AND table_name = 'notification_preferences' 
      AND constraint_name = 'notification_preferences_user_id_fkey'
  ) THEN
    ALTER TABLE public.notification_preferences DROP CONSTRAINT notification_preferences_user_id_fkey;
  END IF;
END$$;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- push_subscriptions.user_id -> public.user_profiles(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
      AND table_schema = 'public' 
      AND table_name = 'push_subscriptions' 
      AND constraint_name = 'push_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE public.push_subscriptions DROP CONSTRAINT push_subscriptions_user_id_fkey;
  END IF;
END$$;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

