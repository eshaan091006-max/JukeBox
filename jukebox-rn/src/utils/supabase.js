import { createClient } from '@supabase/supabase-js';

// Replace these placeholders with your actual Supabase configurations
const supabaseUrl = 'https://cswprganutaarmwnbixs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzd3ByZ2FudXRhYXJtd25iaXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzQ3NTQsImV4cCI6MjA5ODQ1MDc1NH0.vlM0-_Q9B9wildXAv8i0HD9ULV9e7uxDEyzh3U8Pt5k';

export const isSupabaseConfigured =
  supabaseUrl &&
  supabaseUrl !== 'YOUR_SUPABASE_URL' &&
  supabaseUrl.startsWith('http');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
