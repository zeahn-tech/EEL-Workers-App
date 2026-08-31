import { createClient } from '@supabase/supabase-js';
import { localDb } from './localDb';

let supabase = null;
let adminActionClient = null;

const resolveCredentials = () => {
  const settings = localDb.getSettings();
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = settings.supabaseUrl || envUrl;
  const key = settings.supabaseAnonKey || envKey;
  return { url, key };
};

export const getSupabaseClient = () => {
  if (supabase) return supabase;

  const { url, key } = resolveCredentials();

  if (url && key && url.startsWith('http')) {
    try {
      supabase = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      console.log('⚡ Connected to Supabase Cloud Instance');
    } catch (e) {
      console.warn('Could not initialize Supabase client:', e.message);
    }
  }

  return supabase;
};

// A second, session-less Supabase client used ONLY for admin actions that call
// supabase.auth.signUp() to create a brand-new worker account. signUp() on the main
// client would silently replace the currently logged-in admin's session with the new
// worker's session — this isolated client keeps that call from ever touching the
// admin's real session (nothing it does is persisted to storage).
export const getAdminActionClient = () => {
  if (adminActionClient) return adminActionClient;

  const { url, key } = resolveCredentials();
  if (url && key && url.startsWith('http')) {
    try {
      adminActionClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    } catch (e) {
      console.warn('Could not initialize Supabase admin-action client:', e.message);
    }
  }
  return adminActionClient;
};

export const isSupabaseConfigured = () => {
  const client = getSupabaseClient();
  return client !== null;
};

/**
 * SQL Schema Reference for Supabase PostgreSQL Database Setup:
 * 
 * CREATE TABLE public.profiles (
 *   id UUID PRIMARY KEY DEFAULT auth.uid(),
 *   name TEXT NOT NULL,
 *   email TEXT UNIQUE NOT NULL,
 *   role TEXT DEFAULT 'Worker',
 *   department TEXT,
 *   status TEXT DEFAULT 'Active',
 *   phone TEXT,
 *   avatar TEXT,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * CREATE TABLE public.messages (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   chat_id TEXT NOT NULL,
 *   sender_id TEXT NOT NULL,
 *   sender_name TEXT NOT NULL,
 *   content TEXT,
 *   type TEXT DEFAULT 'text',
 *   file_data JSONB,
 *   image_data JSONB,
 *   location JSONB,
 *   timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   status TEXT DEFAULT 'sent'
 * );
 * 
 * CREATE TABLE public.groups (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   name TEXT NOT NULL,
 *   description TEXT,
 *   created_by TEXT NOT NULL,
 *   members TEXT[] DEFAULT '{}',
 *   avatar TEXT,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 *
 * IMPORTANT: creating these tables is not enough on its own — Row Level Security
 * blocks all access by default until matching policies exist. Run
 * /supabase/profiles-rls-policies.sql (in this repo) in your Supabase SQL Editor
 * to add the required policies for sign-up, login, self-service profile edits,
 * and admin staff management. Without it you'll see errors like "permission
 * denied for table profiles" and "No staff profile found for this account."
 */
