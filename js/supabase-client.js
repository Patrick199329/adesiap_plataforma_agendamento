/**
 * FrotaFlow — Supabase Client
 * Inicializa a conexão com o Supabase.
 */

const SUPABASE_URL = 'https://cztbqbvjhqvibbtqxgkh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6dGJxYnZqaHF2aWJidHF4Z2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTM4OTEsImV4cCI6MjA5MTkyOTg5MX0.lXSiM8gQb4nLXYqWdzTpzHTgdWwCXbJPhPxudO0b-eA';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('FrotaFlow: Supabase Client inicializado.');
