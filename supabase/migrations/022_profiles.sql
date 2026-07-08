-- 022_profiles.sql
-- User profiles so task assignees resolve to real names instead of UUIDs.

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  department text CHECK (department IN ('tech','operations','sales','customer_success')),
  avatar_initials text GENERATED ALWAYS AS (upper(left(full_name, 1))) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "authenticated can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, department)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'tech'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Manual profile creation RPC (for existing users)
CREATE OR REPLACE FUNCTION upsert_profile(
  p_full_name text,
  p_email text,
  p_department text DEFAULT 'tech'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, department)
  VALUES (auth.uid(), p_full_name, p_email, p_department)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    department = EXCLUDED.department,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_profile(text, text, text) TO authenticated;
