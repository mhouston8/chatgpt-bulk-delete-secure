// Supabase configuration
const SUPABASE_URL = 'https://bmkolobyzsmbwglhgnpe.supabase.co'; // Your Supabase project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJta29sb2J5enNtYndnbGhnbnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4Nzc3MTQsImV4cCI6MjA2NDQ1MzcxNH0.YqzBB4cD8Mfh0cmpFnd_V3js54IlkumnDft_YAYNyAU'; // Your Supabase anon/public key

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Example function to test the connection
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabaseClient.from('User').select('*').limit(1);
        if (error) throw error;
        console.log('Supabase connection successful:', data);
        return true;
    } catch (error) {
        console.error('Supabase connection error:', error.message);
        return false;
    }
}

// Make functions available globally
window.supabaseClient = supabaseClient;
window.testSupabaseConnection = testSupabaseConnection; 