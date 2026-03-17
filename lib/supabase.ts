import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gwdbvwghamrwcfqksmhw.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGJ2d2doYW1yd2NmcWtzbWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NjQyMjMsImV4cCI6MjA4ODM0MDIyM30.M3XJVXOc0DxTM2z695Sld3OXTDhRi1MoIz2VSdbOOsE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
