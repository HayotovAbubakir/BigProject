# BigProject - Inventory Management System

A React-based inventory management application with Supabase backend.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Settings > API to get your project URL and anon key
   - Copy `.env.example` to `.env` and fill in your Supabase credentials:
     ```
     VITE_SUPABASE_URL=your_project_url
     VITE_SUPABASE_KEY=your_anon_key
     ```

3. **Set up the database:**
   - In your Supabase dashboard, go to SQL Editor
   - Run the SQL from `supabase/schema.sql` to create the necessary tables and policies

4. **Initialize admin users:**
   - After running the schema, run the SQL from `supabase/init_admins.sql` in Supabase SQL Editor
   - Edit the file to set actual passwords for hamdamjon and habibjon before running

5. **Create additional users:**
   - Admin users (hamdamjon, habibjon) can create new users through the app's "Foydalanuvchi qo'shish" tab
   - Regular users can login with username/password created by admins

6. **Run the app:**
   ```bash
   npm run dev
   ```

## Features

- Warehouse management
- Store inventory
- Sales tracking
- Credit management
- Custom username/password authentication
- Admin-managed user accounts
- Real-time data sync with Supabase

## Authentication System

- **Admins**: hamdamjon and habibjon can create new user accounts
- **Users**: Login with username/password provided by admins
- **No email registration**: All accounts are created by admins only
- **Session management**: 24-hour sessions stored in browser

## Migration from Local Storage

This app previously used local IndexedDB storage. It has been migrated to use Supabase for cloud storage.

- All data is now stored in Supabase PostgreSQL
- Authentication uses custom username/password system
- Data is synced across devices
