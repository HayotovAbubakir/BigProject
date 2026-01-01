-- Supabase Database Schema for BigProject
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security
ALTER TABLE IF EXISTS app_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_credentials ENABLE ROW LEVEL SECURITY;

-- Create user_credentials table for custom authentication
CREATE TABLE IF NOT EXISTS user_credentials (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_credentials_username ON user_credentials(username);

-- Create app_states table to store application state as JSON
CREATE TABLE IF NOT EXISTS app_states (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  state_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_app_states_username ON app_states(username);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at on user_credentials
CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON user_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on app_states
CREATE TRIGGER update_app_states_updated_at
  BEFORE UPDATE ON app_states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security policies for user_credentials
-- Only admins can view all users, regular users can only see themselves
CREATE POLICY "Admins can view all user credentials" ON user_credentials
  FOR SELECT USING (auth.jwt() ->> 'username' IN ('hamdamjon', 'habibjon'));

CREATE POLICY "Users can view their own credentials" ON user_credentials
  FOR SELECT USING (username = auth.jwt() ->> 'username');

CREATE POLICY "Admins can insert user credentials" ON user_credentials
  FOR INSERT WITH CHECK (auth.jwt() ->> 'username' IN ('hamdamjon', 'habibjon'));

CREATE POLICY "Admins can update user credentials" ON user_credentials
  FOR UPDATE USING (auth.jwt() ->> 'username' IN ('hamdamjon', 'habibjon'));

CREATE POLICY "Admins can delete user credentials" ON user_credentials
  FOR DELETE USING (auth.jwt() ->> 'username' IN ('hamdamjon', 'habibjon'));

-- Row Level Security policies for app_states
-- Users can only access their own state or shared state
CREATE POLICY "Users can view their own app state" ON app_states
  FOR SELECT USING (auth.uid() IS NOT NULL AND username = auth.jwt() ->> 'username');

CREATE POLICY "Users can view shared app state" ON app_states
  FOR SELECT USING (username = 'shared');

CREATE POLICY "Users can insert their own app state" ON app_states
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND username = auth.jwt() ->> 'username');

CREATE POLICY "Users can update their own app state" ON app_states
  FOR UPDATE USING (auth.uid() IS NOT NULL AND username = auth.jwt() ->> 'username');

CREATE POLICY "Users can delete their own app state" ON app_states
  FOR DELETE USING (auth.uid() IS NOT NULL AND username = auth.jwt() ->> 'username');

-- Allow shared state operations (for admin users)
CREATE POLICY "Admins can manage shared state" ON app_states
  FOR ALL USING (username = 'shared' AND auth.jwt() ->> 'username' IN ('hamdamjon', 'habibjon'));