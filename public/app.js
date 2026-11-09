import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase configuration
const SUPABASE_URL = 'https://gpqmziopdpgfwymjjfp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hA9Shuy0QkhkX-VN0Ymzzw_yYMUegyW';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sync content function
window.syncContent = async function() {
    alert("Syncing with Supabase...");
    const { data, error } = await supabase.from('chapters').select('*');
    if (error) {
        alert("Sync failed: " + error.message);
    } else {
        localStorage.setItem('bdu_chapters', JSON.stringify(data));
        alert("Synced successfully!");
    }
}
