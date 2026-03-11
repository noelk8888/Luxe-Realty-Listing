import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// ── Feature types (mirrored from LUXE Edit) ───────────────────────────────────
export type Feature =
    | 'add_listing'
    | 'edit_listing'
    | 'delete_listing'
    | 'telegram_send'
    | 'batch_review'
    | 'ai_extract'
    | 'geocoding'
    | 'view_pricing'
    | 'view_contact'
    | 'view_geo_id'
    | 'view_photos'
    | 'export_data'
    | 'manage_users'
    | 'view_fb_link'
    | 'view_col_k'
    | 'view_col_aa'
    | 'view_col_ac'
    | 'view_map'
    | 'view_copy'
    | 'view_notes'
    | 'change_status'
    | 'geo_id_click'
    | 'edit_sale_price'
    | 'edit_lease_price'
    | 'edit_notes'
    | 'edit_coordinates'
    | 'edit_fb_link'
    | 'edit_update_date';

const ALL_FEATURES: Feature[] = [
    'add_listing', 'edit_listing', 'delete_listing',
    'telegram_send', 'batch_review', 'ai_extract',
    'geocoding', 'view_pricing', 'view_contact',
    'view_geo_id', 'view_photos', 'export_data', 'manage_users',
    'view_fb_link',
    'view_col_k', 'view_col_aa', 'view_col_ac',
    'view_map', 'view_copy', 'view_notes',
    'change_status', 'geo_id_click',
    'edit_sale_price', 'edit_lease_price', 'edit_notes',
    'edit_coordinates', 'edit_fb_link', 'edit_update_date',
];

// ── Role defaults ─────────────────────────────────────────────────────────────
const ROLE_DEFAULTS: Record<'admin' | 'editor' | 'broker' | 'viewer', Record<Feature, boolean>> = {
    admin: {
        add_listing: true, edit_listing: true, delete_listing: true,
        telegram_send: true, batch_review: true, ai_extract: true,
        geocoding: true, view_pricing: true, view_contact: true,
        view_geo_id: true, view_photos: true, export_data: true, manage_users: true,
        view_fb_link: true,
        view_col_k: true, view_col_aa: true, view_col_ac: true,
        view_map: true, view_copy: true, view_notes: true,
        change_status: true, geo_id_click: true,
        edit_sale_price: true, edit_lease_price: true, edit_notes: true,
        edit_coordinates: true, edit_fb_link: true, edit_update_date: true,
    },
    editor: {
        add_listing: true, edit_listing: true, delete_listing: false,
        telegram_send: false, batch_review: true, ai_extract: true,
        geocoding: true, view_pricing: true, view_contact: true,
        view_geo_id: true, view_photos: true, export_data: true, manage_users: false,
        view_fb_link: true,
        view_col_k: true, view_col_aa: true, view_col_ac: true,
        view_map: true, view_copy: true, view_notes: true,
        change_status: true, geo_id_click: true,
        edit_sale_price: true, edit_lease_price: true, edit_notes: true,
        edit_coordinates: true, edit_fb_link: true, edit_update_date: true,
    },
    broker: {
        add_listing: true, edit_listing: true, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: true,
        geocoding: true, view_pricing: true, view_contact: true,
        view_geo_id: true, view_photos: true, export_data: false, manage_users: false,
        view_fb_link: true,
        view_col_k: true, view_col_aa: true, view_col_ac: true,
        view_map: true, view_copy: true, view_notes: true,
        change_status: true, geo_id_click: true,
        edit_sale_price: false, edit_lease_price: false, edit_notes: false,
        edit_coordinates: true, edit_fb_link: true, edit_update_date: true,
    },
    viewer: {
        add_listing: false, edit_listing: false, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: false,
        geocoding: false, view_pricing: false, view_contact: false,
        view_geo_id: false, view_photos: true, export_data: false, manage_users: false,
        view_fb_link: false,
        view_col_k: false, view_col_aa: true, view_col_ac: true,
        view_map: true, view_copy: false, view_notes: false,
        change_status: false, geo_id_click: true,
        edit_sale_price: false, edit_lease_price: false, edit_notes: false,
        edit_coordinates: false, edit_fb_link: false, edit_update_date: false,
    },
};

const ALL_ENABLED = Object.fromEntries(ALL_FEATURES.map(f => [f, true])) as Record<Feature, boolean>;
const ALL_DENIED  = Object.fromEntries(ALL_FEATURES.map(f => [f, false])) as Record<Feature, boolean>;

async function resolvePermissions(email: string, role: string): Promise<Record<Feature, boolean>> {
    if (role === 'superadmin') return ALL_ENABLED;
    if (!['admin', 'editor', 'broker', 'viewer'].includes(role)) return ALL_DENIED;

    const typedRole = role as 'admin' | 'editor' | 'broker' | 'viewer';
    const perms: Record<Feature, boolean> = { ...ROLE_DEFAULTS[typedRole] };

    // Apply role-level DB overrides
    const { data: rolePerms } = await supabase
        .from('luxe_listing_role_permissions')
        .select('feature, enabled')
        .eq('role', role.toUpperCase());

    if (rolePerms) {
        for (const row of rolePerms) {
            if (ALL_FEATURES.includes(row.feature as Feature)) {
                perms[row.feature as Feature] = row.enabled;
            }
        }
    }

    // Apply per-user overrides (highest priority)
    const { data: userOverrides } = await supabase
        .from('user_permission_overrides')
        .select('feature, enabled')
        .eq('user_email', email.toLowerCase());

    if (userOverrides) {
        for (const row of userOverrides) {
            if (ALL_FEATURES.includes(row.feature as Feature)) {
                perms[row.feature as Feature] = row.enabled;
            }
        }
    }

    return perms;
}

// ── Context ───────────────────────────────────────────────────────────────────
interface PermissionsContextType {
    permissions: Record<Feature, boolean>;
    isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const { user, role } = useAuth();
    const [permissions, setPermissions] = useState<Record<Feature, boolean>>(ALL_DENIED);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user?.email || !role) {
            setPermissions(ALL_DENIED);
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        resolvePermissions(user.email, role).then(perms => {
            if (cancelled) return;
            setPermissions(perms);
            setIsLoading(false);
        }).catch(() => {
            if (cancelled) return;
            setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, [user?.email, role]);

    return (
        <PermissionsContext.Provider value={{ permissions, isLoading }}>
            {children}
        </PermissionsContext.Provider>
    );
}

export function usePermissions() {
    const context = useContext(PermissionsContext);
    if (context === undefined) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
}
