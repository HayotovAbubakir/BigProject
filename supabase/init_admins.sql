-- Initialize admin users
-- Run this after running schema.sql in Supabase SQL Editor
-- Replace 'admin_password_1' and 'admin_password_2' with actual passwords

INSERT INTO user_credentials (username, password_hash, created_by) VALUES
('hamdamjon', 'admin_password_1', 'system'),
('habibjon', 'admin_password_2', 'system')
ON CONFLICT (username) DO NOTHING;