import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rtfsrnvjzayabppcpmda.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZnNybnZqemF5YWJwcGNwbWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNDgwNzUsImV4cCI6MjA2MjYyNDA3NX0.Vijjzm-MRO4eQHaC9t9WOvQVYOkYKdgnwzFBUn63Cew'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
