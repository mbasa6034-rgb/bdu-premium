import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase configuration
const SUPABASE_URL = 'https://gpqmziopdpgfwymjjfp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hA9Shuy0QkhkX-VN0Ymzzw_yYMUegyW';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Generate or retrieve a unique ID for the current device/browser
function getDeviceId() {
    let deviceId = localStorage.getItem('bdu_device_id');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('bdu_device_id', deviceId);
    }
    return deviceId;
}

// Enforce One Account = One Registered Device policy
window.verifyDeviceAccess = async function(userId) {
    const deviceId = getDeviceId();
    
    const { data, error } = await supabase
        .from('device_registrations')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        alert("Device check failed: " + error.message);
        return false;
    }

    if (!data) {
        // Register this device for the user
        const { error: insertError } = await supabase
            .from('device_registrations')
            .insert([{ user_id: userId, device_id: deviceId }]);
            
        if (insertError) {
            alert("Failed to bind device: " + insertError.message);
            return false;
        }
        alert("Device successfully bound to this account!");
        return true;
    } else {
        if (data.device_id === deviceId) {
            return true; // Access granted
        } else {
            alert("Access Denied: This account is already active on a different registered device.");
            return false; // Access blocked
        }
    }
}

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
