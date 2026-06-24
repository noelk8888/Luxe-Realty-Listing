import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Copied resolvePermissions logic from PermissionsContext
const ALL_FEATURES = [
    'add_listing', 'edit_listing', 'delete_listing',
    'telegram_send', 'batch_review', 'ai_extract',
    'geocoding', 'view_pricing',
    'view_photos', 'export_data', 'manage_users',
    'view_fb_link',
    'view_col_k', 'view_listing_ownership', 'view_col_aa', 'view_col_ac',
    'view_map', 'view_copy', 'view_notes',
    'change_status', 'geo_id_click',
    'edit_sale_price', 'edit_lease_price', 'edit_notes',
    'edit_coordinates', 'edit_fb_link', 'edit_update_date',
    'show_all', 'view_last_update', 'edit_monthly_dues', 'copy_photo_link',
    'full_screen_map',
    'map_preview', 'viewing_listing',
    'preview_pic'
];

const ROLE_DEFAULTS = {
    v1: {
        add_listing: false, edit_listing: false, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: false,
        view_pricing: false,
        view_photos: true, export_data: false, manage_users: false,
        view_fb_link: false,
        view_col_k: false, view_listing_ownership: false, view_col_aa: true, view_col_ac: true,
        view_map: true, view_copy: false, view_notes: false,
        change_status: false, geo_id_click: true,
        edit_sale_price: false, edit_lease_price: false, edit_notes: false,
        edit_coordinates: false, edit_fb_link: false, edit_update_date: false,
        show_all: false, view_last_update: true, edit_monthly_dues: false, copy_photo_link: false,
        full_screen_map: false,
        map_preview: true, viewing_listing: false,
        preview_pic: true,
    },
    v2: {
        add_listing: false, edit_listing: false, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: false,
        view_pricing: false,
        view_photos: false, export_data: false, manage_users: false,
        view_fb_link: false,
        view_col_k: false, view_listing_ownership: false, view_col_aa: false, view_col_ac: false,
        view_map: false, view_copy: false, view_notes: false,
        change_status: false, geo_id_click: false,
        edit_sale_price: false, edit_lease_price: false, edit_notes: false,
        edit_coordinates: false, edit_fb_link: false, edit_update_date: false,
        show_all: false, view_last_update: true, edit_monthly_dues: false, copy_photo_link: false,
        full_screen_map: false,
        map_preview: false, viewing_listing: false,
        preview_pic: false,
    },
};

async function resolvePermissions(email, role) {
    console.log(`\nResolving permissions for ${email} (${role})`);
    const typedRole = role;
    const perms = { ...ROLE_DEFAULTS[typedRole] };
    console.log('Defaults for role:', JSON.stringify(perms, null, 2));

    const rolesToQuery = role.toUpperCase() === 'V1' ? ['V1', 'VIEWER'] : [role.toUpperCase()];
    const { data: rolePerms } = await supabase
        .from('luxe_listing_role_permissions')
        .select('role, feature, enabled')
        .in('role', rolesToQuery);

    console.log('Fetched role overrides:', rolePerms);

    if (rolePerms) {
        const viewerPerms = rolePerms.filter(r => ((r.role) || '').toUpperCase() === 'VIEWER');
        for (const row of viewerPerms) {
            if (ALL_FEATURES.includes(row.feature)) {
                perms[row.feature] = row.enabled;
            }
        }
        const activeRolePerms = rolePerms.filter(r => ((r.role) || '').toUpperCase() !== 'VIEWER');
        for (const row of activeRolePerms) {
            if (ALL_FEATURES.includes(row.feature)) {
                perms[row.feature] = row.enabled;
            }
        }
    }
    
    console.log('After applying role overrides:', JSON.stringify(perms, null, 2));
    return perms;
}

async function test() {
  await resolvePermissions('iamnoel888@gmail.com', 'v2');
}

test();
