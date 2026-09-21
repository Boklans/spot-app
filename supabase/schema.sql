-- ==============================================================================
-- SPOT APP: Supabase PostgreSQL Schema & Security Policies
-- Copy & Run this in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'IHOR',
  avatar TEXT NOT NULL DEFAULT 'gorilla',
  weight_kg NUMERIC DEFAULT 78,
  height_cm NUMERIC DEFAULT 180,
  goal TEXT DEFAULT 'Build Muscle',
  experience TEXT DEFAULT 'Intermediate',
  workouts_per_week INT DEFAULT 3,
  weight_unit TEXT DEFAULT 'kg',
  height_unit TEXT DEFAULT 'cm',
  default_rest_seconds INT DEFAULT 90,
  language TEXT DEFAULT 'uk',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Programs Table
CREATE TABLE IF NOT EXISTS public.user_programs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_per_week INT NOT NULL DEFAULT 3,
  program_data JSONB NOT NULL,
  progress_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Workout History Table
CREATE TABLE IF NOT EXISTS public.workout_history (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_name TEXT NOT NULL,
  workout_data JSONB NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Body Weight Logs Table
CREATE TABLE IF NOT EXISTS public.body_weight_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg NUMERIC NOT NULL,
  date TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- Enable Row Level Security (RLS) - Users can only access their own data
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_weight_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User Programs Policies
CREATE POLICY "Users can manage own programs" ON public.user_programs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Workout History Policies
CREATE POLICY "Users can manage own workout history" ON public.workout_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Body Weight Logs Policies
CREATE POLICY "Users can manage own weight logs" ON public.body_weight_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- Automatic Trigger: Create a profile row when a new user signs up
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar, language)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Athlete'),
    'gorilla',
    COALESCE(new.raw_user_meta_data->>'language', 'uk')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

