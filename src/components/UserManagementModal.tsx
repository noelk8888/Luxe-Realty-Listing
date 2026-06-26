import React, { useEffect, useState } from 'react';
import { X, Users, Shield, Plus, Trash2, Loader2, Check, AlertCircle, Pencil, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Feature } from '../contexts/PermissionsContext';
import { useAuth } from '../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type AppRole = 'SUPERADMIN' | 'ADMIN' | 'EDITOR' | 'BROKER' | 'V1' | 'V2';
type Tab = 'users' | 'permissions' | 'groups';

interface FbGroup {
    id: string;
    name: string;
    fb_link: string;
    brand_name: string | null;
    logo_url: string | null;
    messenger_url: string | null;
    instagram_url: string | null;
    tiktok_url: string | null;
    youtube_url: string | null;
    spearheaded_by: string | null;
}

interface AppUser {
    id?: string;
    email: string;
    name: string;
    role: AppRole;
    fb_link?: string;
    fb_group?: string;
    created_by?: string;
    login_count?: number;
    last_login?: string;
}

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES: AppRole[] = ['ADMIN', 'EDITOR', 'BROKER', 'V1', 'V2'];

const ROLE_ORDER: Record<string, number> = {
    SUPERADMIN: 0,
    ADMIN: 0,
    EDITOR: 1,
    BROKER: 2,
    V1: 3,
    V2: 4,
};

// Hardcoded masking for "Stealth" users
const MASKED_ROLES_UPPER: Record<string, AppRole> = {
    'noelkiu@gmail.com': 'ADMIN',
    'lesliekiudmd@yahoo.com': 'BROKER',
};

const ROLE_BADGE: Record<AppRole, string> = {
    SUPERADMIN: 'bg-purple-50 text-purple-700 border border-purple-200', // matches ADMIN
    ADMIN:  'bg-purple-50 text-purple-700 border border-purple-200',
    EDITOR: 'bg-amber-50 text-amber-700 border border-amber-200',
    BROKER: 'bg-blue-50 text-blue-700 border border-blue-200',
    V1: 'bg-gray-100 text-gray-500 border border-gray-200',
    V2: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const ROLE_TOGGLE_COLORS: Record<AppRole, string> = {
    SUPERADMIN: 'bg-indigo-600',
    ADMIN:  'bg-purple-500',
    EDITOR: 'bg-amber-500',
    BROKER: 'bg-blue-500',
    V1: 'bg-gray-400',
    V2: 'bg-gray-400',
};

const FEATURES: { key: Feature; label: string; group: string; active: boolean }[] = [
    // ── Listing Card ──────────────────────────────────────────────────────────
    { key: 'view_col_k',            label: 'Owner/Cobroker',    group: 'Listing Card',  active: true  },
    { key: 'view_listing_ownership', label: 'Listing Ownership', group: 'Listing Card', active: true  },
    { key: 'view_pricing',          label: 'View Pricing',      group: 'Listing Card',  active: true  },
    { key: 'view_photos',           label: 'Photo Button',      group: 'Listing Card',  active: true  },
    { key: 'view_col_aa',           label: 'Listing Details',   group: 'Listing Card',  active: true  },
    { key: 'show_all',              label: 'Show All Toggle',   group: 'Listing Card',  active: true  },
    { key: 'view_fb_link',          label: 'FB Link Button',    group: 'Listing Card',  active: true  },
    { key: 'view_map',              label: 'G-Map Button',      group: 'Listing Card',  active: true  },
    { key: 'view_copy',             label: 'Copy Button',       group: 'Listing Card',  active: true  },
    { key: 'view_notes',            label: 'Notes Button',      group: 'Listing Card',  active: true  },
    { key: 'change_status',         label: 'Change Status',     group: 'Listing Card',  active: true  },
    { key: 'geo_id_click',          label: 'GEO ID Click',      group: 'Listing Card',  active: true  },
    { key: 'view_col_ac',           label: 'GEO ID',            group: 'Listing Card',  active: true  },
    { key: 'view_last_update',      label: 'Last Update',       group: 'Listing Card',  active: true  },
    { key: 'copy_photo_link',       label: 'Copy Photo Link',   group: 'Listing Card',  active: true  },
    { key: 'edit_listing',          label: 'Edit Button',       group: 'Listing Card',  active: true  },
    { key: 'viewing_listing',       label: 'Viewing Button',    group: 'Listing Card',  active: true  },
    { key: 'full_screen_map',       label: 'Neighbor Map FS',   group: 'Listing Card',  active: true  },
    { key: 'map_preview',           label: 'Map Preview',       group: 'Listing Card',  active: true  },
    { key: 'preview_pic',           label: 'Preview Pic',       group: 'Listing Card',  active: true  },
    { key: 'discreet',              label: 'Discreet Listings', group: 'Listing Card',  active: true  },
    { key: 'facade',                label: 'Facade Previews',   group: 'Listing Card',  active: true  },
    // ── Edit Section ──────────────────────────────────────────────────────────
    { key: 'edit_sale_price',       label: 'Sale Price',        group: 'Edit Section',  active: true  },
    { key: 'edit_lease_price',      label: 'Lease Price',       group: 'Edit Section',  active: true  },
    { key: 'edit_notes',            label: 'Notes',             group: 'Edit Section',  active: true  },
    { key: 'edit_coordinates',      label: 'Coordinates',       group: 'Edit Section',  active: true  },
    { key: 'geocoding',             label: 'GPS / HERE Button', group: 'Edit Section',  active: true  },
    { key: 'edit_fb_link',          label: 'Facebook Link',     group: 'Edit Section',  active: true  },
    { key: 'edit_monthly_dues',     label: 'Monthly Dues',      group: 'Edit Section',  active: true  },
    { key: 'edit_update_date',      label: 'Update Date',       group: 'Edit Section',  active: true  },
];

const FEATURE_GROUPS = ['Listing Card', 'Edit Section'];

const ROLE_DEFAULTS: Record<AppRole, Record<Feature, boolean>> = {
    SUPERADMIN: {
        // Same as ADMIN but used for first-class recognition
        view_col_k: true, view_listing_ownership: true, view_pricing: true,
        view_photos: true, view_col_aa: true, view_col_ac: true,
        show_all: true, view_fb_link: true, view_map: true, view_copy: true, view_notes: true,
        change_status: true, geo_id_click: true, view_last_update: true, copy_photo_link: false, edit_listing: true,
        viewing_listing: true, full_screen_map: true, map_preview: true,
        preview_pic: true,
        discreet: true, facade: true,
        // Edit Section
        edit_sale_price: true, edit_lease_price: true, edit_notes: true, edit_monthly_dues: true,
        edit_coordinates: true, geocoding: true, edit_fb_link: true, edit_update_date: true,
        // Misc
        add_listing: true, delete_listing: true,
        telegram_send: true, batch_review: true, ai_extract: true,
        export_data: true, manage_users: true,
    },
    ADMIN: {
        // Listing Card
        view_col_k: true, view_listing_ownership: true, view_pricing: true,
        view_photos: true, view_col_aa: true, view_col_ac: true,
        show_all: true, view_fb_link: true, view_map: true, view_copy: true, view_notes: true,
        change_status: true, geo_id_click: true, view_last_update: true, copy_photo_link: false, edit_listing: true,
        viewing_listing: true, full_screen_map: true, map_preview: true,
        preview_pic: true,
        discreet: true, facade: true,
        // Edit Section
        edit_sale_price: true, edit_lease_price: true, edit_notes: true, edit_monthly_dues: true,
        edit_coordinates: true, geocoding: true, edit_fb_link: true, edit_update_date: true,
        // Misc
        add_listing: true, delete_listing: true,
        telegram_send: true, batch_review: true, ai_extract: false,
        export_data: true, manage_users: true,
    },
    EDITOR: {
        add_listing: true, edit_listing: true, delete_listing: false,
        telegram_send: false, batch_review: true, ai_extract: false,
        // Listing Card
        view_col_k: true, view_listing_ownership: true, view_pricing: true,
        view_photos: true, view_col_aa: true, view_col_ac: true,
        show_all: true, view_fb_link: true, view_map: true, view_copy: true, view_notes: true,
        change_status: true, geo_id_click: true, view_last_update: true, copy_photo_link: false,
        viewing_listing: false, full_screen_map: false, map_preview: true,
        preview_pic: true,
        discreet: true, facade: true,
        // Edit Section
        edit_sale_price: true, edit_lease_price: true, edit_notes: true, edit_monthly_dues: true,
        edit_coordinates: true, geocoding: true, edit_fb_link: true, edit_update_date: true,
        // Misc
        export_data: true, manage_users: false,
    },
    BROKER: {
        add_listing: true, edit_listing: true, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: false,
        // Listing Card
        view_col_k: true, view_listing_ownership: true, view_pricing: true,
        view_photos: true, view_col_aa: true, view_col_ac: true,
        show_all: true, view_fb_link: true, view_map: true, view_copy: true, view_notes: true,
        change_status: true, geo_id_click: true, view_last_update: true, copy_photo_link: false,
        viewing_listing: false, full_screen_map: false, map_preview: true,
        preview_pic: true,
        discreet: true, facade: true,
        // Edit Section
        edit_sale_price: false, edit_lease_price: false, edit_notes: false, edit_monthly_dues: false,
        edit_coordinates: true, geocoding: true, edit_fb_link: true, edit_update_date: true,
        // Misc
        export_data: false, manage_users: false,
    },
    V1: {
        add_listing: false, edit_listing: false, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: false,
        // Listing Card
        view_col_k: false, view_listing_ownership: false, view_pricing: false,
        view_photos: true, view_col_aa: true, view_col_ac: true,
        show_all: false, view_fb_link: false, view_map: true, view_copy: false, view_notes: false,
        change_status: false, geo_id_click: true, view_last_update: true, copy_photo_link: false,
        viewing_listing: false, full_screen_map: false, map_preview: true,
        preview_pic: true,
        discreet: true, facade: true,
        // Edit Section
        edit_sale_price: false, edit_lease_price: false, edit_notes: false, edit_monthly_dues: false,
        edit_coordinates: false, geocoding: false, edit_fb_link: false, edit_update_date: false,
        // Misc
        export_data: false, manage_users: false,
    },
    V2: {
        add_listing: false, edit_listing: false, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: false,
        // Listing Card
        view_col_k: false, view_listing_ownership: false, view_pricing: false,
        view_photos: false, view_col_aa: false, view_col_ac: false,
        show_all: false, view_fb_link: false, view_map: false, view_copy: false, view_notes: false,
        change_status: false, geo_id_click: false, view_last_update: true, copy_photo_link: false,
        viewing_listing: false, full_screen_map: false, map_preview: false,
        preview_pic: false,
        discreet: false, facade: false,
        // Edit Section
        edit_sale_price: false, edit_lease_price: false, edit_notes: false, edit_monthly_dues: false,
        edit_coordinates: false, geocoding: false, edit_fb_link: false, edit_update_date: false,
        // Misc
        export_data: false, manage_users: false,
    },
};

type PermState = Record<Feature, Record<AppRole, boolean>>;

function buildDefaultPermState(): PermState {
    const state = {} as PermState;
    for (const f of FEATURES) {
        state[f.key] = {
            SUPERADMIN: ROLE_DEFAULTS.SUPERADMIN[f.key],
            ADMIN:   ROLE_DEFAULTS.ADMIN[f.key],
            EDITOR:  ROLE_DEFAULTS.EDITOR[f.key],
            BROKER:  ROLE_DEFAULTS.BROKER[f.key],
            V1:  ROLE_DEFAULTS.V1[f.key],
            V2:  ROLE_DEFAULTS.V2[f.key],
        };
    }
    return state;
}

function Toggle({ enabled, onChange, disabled, color }: {
    enabled: boolean; onChange: () => void; disabled?: boolean; color: string;
}) {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${enabled ? color : 'bg-gray-200'}`}
        >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
    const { role: currentRoleRaw } = useAuth();
    const currentRole = (currentRoleRaw || '').toUpperCase() as AppRole;
    const isSuperAdmin = currentRole === 'SUPERADMIN';
    const visibleRoles: AppRole[] = currentRole === 'ADMIN'
        ? ['EDITOR', 'BROKER', 'V1', 'V2']
        : ['ADMIN', 'EDITOR', 'BROKER', 'V1', 'V2'];

    const [activeTab, setActiveTab] = useState<Tab>('users');

    // ── Users tab state
    const [users, setUsers] = useState<AppUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [editingEmail, setEditingEmail] = useState<string | null>(null);
    const [editRole, setEditRole] = useState<AppRole>('V1');
    const [editName, setEditName] = useState('');
    const [editFbLink, setEditFbLink] = useState('');
    const [editFbGroup, setEditFbGroup] = useState('');
    const [savingUser, setSavingUser] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deletingUser, setDeletingUser] = useState<string | null>(null);

    // Add user form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<AppRole>('V1');
    const [newFbLink, setNewFbLink] = useState('');
    const [newFbGroup, setNewFbGroup] = useState('');
    const [addingUser, setAddingUser] = useState(false);

    // ── Groups tab state
    const [groups, setGroups] = useState<FbGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState('');
    const [_newGroupFbLink, setNewGroupFbLink] = useState('');
    const [addingGroup, setAddingGroup] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [_editGroupFbLink, setEditGroupFbLink] = useState('');
    const [editBrandName, setEditBrandName] = useState('');
    const [editLogoUrl, setEditLogoUrl] = useState('');
    const [editFacebookUrl, setEditFacebookUrl] = useState('');
    const [editMessengerUrl, setEditMessengerUrl] = useState('');
    const [editInstagramUrl, setEditInstagramUrl] = useState('');
    const [editTiktokUrl, setEditTiktokUrl] = useState('');
    const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
    const [editSpearheadedBy, setEditSpearheadedBy] = useState('');
    const [savingGroup, setSavingGroup] = useState<string | null>(null);
    const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
    const [deletingGroup, setDeletingGroup] = useState<string | null>(null);

    // ── Permissions tab state
    const [perms, setPerms] = useState<PermState>(buildDefaultPermState());
    const [permsLoading, setPermsLoading] = useState(true);
    const [savingPerm, setSavingPerm] = useState<string | null>(null);

    // ── Shared status
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            fetchUsers();
            fetchPermissions();
            fetchGroups();
        } else {
            document.body.style.overflow = 'unset';
            setError(null);
            setSuccessMsg(null);
            setShowAddForm(false);
            setEditingEmail(null);
            setEditingGroupId(null);
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    useEffect(() => { setError(null); setSuccessMsg(null); }, [activeTab]);

    function showSuccess(msg: string) {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    }

    // ── Users ──────────────────────────────────────────────────────────────────
    async function fetchUsers() {
        setUsersLoading(true);
        const { data, error } = await supabase
            .from('luxe_listing_users')
            .select('id, email, name, role, fb_link, fb_group, created_by, login_count, last_login');

        if (error) {
            setError('Failed to load users: ' + error.message);
        } else {
            const formattedUsers = (data ?? [])
                .map(u => {
                    let r = (u.role as string).toUpperCase();
                    if (r === 'VIEWER') r = 'V1';
                    return {
                        ...u,
                        role: r as AppRole
                    };
                })
                .filter(u => {
                    // Non-superadmins cannot see KIU group members (except leslie@luxerealtyph.com)
                    if (isSuperAdmin) return true;
                    
                    const isKiuGroup = (u.fb_group || '').trim().toLowerCase() === 'kiu';
                    const isLeslie = u.email.toLowerCase() === 'leslie@luxerealtyph.com';
                    
                    if (isKiuGroup && !isLeslie) return false;
                    return true;
                });

            // Custom sort logic:
            // 1. By Role (ADMIN > EDITOR > BROKER > V1 > V2)
            // 2. By Last Login (most recent first)
            // 3. By Name (alphabetical)
            formattedUsers.sort((a, b) => {
                // Sort by role priority
                const aRolePriority = ROLE_ORDER[a.role] ?? 99;
                const bRolePriority = ROLE_ORDER[b.role] ?? 99;
                if (aRolePriority !== bRolePriority) {
                    return aRolePriority - bRolePriority;
                }

                // Sort by last login (descending)
                if (a.last_login && b.last_login) {
                    return new Date(b.last_login).getTime() - new Date(a.last_login).getTime();
                } else if (a.last_login) {
                    return -1; // a has login, b doesn't, a goes first
                } else if (b.last_login) {
                    return 1; // b has login, a doesn't, b goes first
                }

                // Final sort by name
                return (a.name || '').localeCompare(b.name || '');
            });

            setUsers(formattedUsers);
        }
        setUsersLoading(false);
    }

    function startEdit(u: AppUser) {
        setEditingEmail(u.email);
        setEditRole(u.role);
        setEditName(u.name);
        setEditFbLink(u.fb_link ?? '');
        setEditFbGroup(u.fb_group ?? '');
        setConfirmDelete(null);
    }

    async function saveEdit(email: string) {
        setSavingUser(email);
        setError(null);
        const { error } = await supabase.from('luxe_listing_users')
            .update({ role: editRole, name: editName, fb_link: editFbLink.trim() || null, fb_group: editFbGroup.trim() || null })
            .eq('email', email);
        if (error) setError('Failed to update: ' + error.message);
        else {
            setUsers(prev => prev.map(u => u.email === email ? { ...u, role: editRole, name: editName, fb_link: editFbLink.trim() || undefined, fb_group: editFbGroup.trim() || undefined } : u));
            showSuccess(`Updated ${email}`);
            setEditingEmail(null);
        }
        setSavingUser(null);
    }

    async function handleDelete(email: string) {
        setDeletingUser(email);
        setError(null);
        const { error } = await supabase.from('luxe_listing_users').delete().eq('email', email);
        if (error) setError('Failed to delete: ' + error.message);
        else {
            setUsers(prev => prev.filter(u => u.email !== email));
            showSuccess(`Removed ${email}`);
        }
        setConfirmDelete(null);
        setDeletingUser(null);
    }

    async function handleAddUser(e: React.FormEvent) {
        e.preventDefault();
        const emailTrimmed = newEmail.trim().toLowerCase();
        if (!emailTrimmed) return;
        setAddingUser(true);
        setError(null);
        const { error } = await supabase.from('luxe_listing_users').insert({
            email: emailTrimmed,
            name: newName.trim() || emailTrimmed.split('@')[0],
            role: newRole,
            fb_link: newFbLink.trim() || null,
            fb_group: newFbGroup.trim() || null,
        });
        if (error) {
            setError(error.code === '23505' ? `${emailTrimmed} is already in the system.` : 'Failed to add user: ' + error.message);
        } else {
            setNewEmail(''); setNewName(''); setNewRole('V1'); setNewFbLink(''); setNewFbGroup('');
            setShowAddForm(false);
            showSuccess(`Added ${emailTrimmed} as ${newRole}`);
            await fetchUsers();
        }
        setAddingUser(false);
    }

    // ── Groups ─────────────────────────────────────────────────────────────────
    async function fetchGroups() {
        setGroupsLoading(true);
        const { data, error } = await supabase
            .from('luxe_listing_fb_groups')
            .select('id, name, fb_link, brand_name, logo_url, messenger_url, instagram_url, tiktok_url, youtube_url, spearheaded_by')
            .order('name');
        if (error) setError('Failed to load groups: ' + error.message);
        else {
            // Luxe always first, then alphabetical
            const sorted = (data ?? []).sort((a, b) => {
                const aIsLuxe = a.name.toLowerCase() === 'luxe';
                const bIsLuxe = b.name.toLowerCase() === 'luxe';
                if (aIsLuxe && !bIsLuxe) return -1;
                if (!aIsLuxe && bIsLuxe) return 1;
                return a.name.localeCompare(b.name);
            });
            setGroups(sorted);
        }
        setGroupsLoading(false);
    }

    async function handleAddGroup(e: React.FormEvent) {
        e.preventDefault();
        const nameTrimmed = newGroupName.trim();
        if (!nameTrimmed) return;
        setAddingGroup(true);
        setError(null);
        const { error } = await supabase.from('luxe_listing_fb_groups').insert({ name: nameTrimmed, fb_link: '' });
        if (error) {
            setError(error.code === '23505' ? `Group "${nameTrimmed}" already exists.` : 'Failed to add group: ' + error.message);
        } else {
            setNewGroupName(''); setNewGroupFbLink('');
            showSuccess(`Added group "${nameTrimmed}"`);
            await fetchGroups();
        }
        setAddingGroup(false);
    }

    async function saveGroupEdit(id: string) {
        setSavingGroup(id);
        setError(null);
        const { error } = await supabase.from('luxe_listing_fb_groups')
            .update({
                name: editGroupName.trim(),
                brand_name: editBrandName.trim() || null,
                logo_url: editLogoUrl.trim() || null,
                fb_link: editFacebookUrl.trim() || '',
                messenger_url: editMessengerUrl.trim() || null,
                instagram_url: editInstagramUrl.trim() || null,
                tiktok_url: editTiktokUrl.trim() || null,
                youtube_url: editYoutubeUrl.trim() || null,
                spearheaded_by: editSpearheadedBy.trim() || null,
            })
            .eq('id', id);
        if (error) setError('Failed to update group: ' + error.message);
        else {
            showSuccess(`Updated group "${editGroupName.trim()}"`);
            setEditingGroupId(null);
            await fetchGroups();
        }
        setSavingGroup(null);
    }

    async function handleDeleteGroup(group: FbGroup) {
        setDeletingGroup(group.id);
        setError(null);
        // Clear fb_group + fb_link on users in this group
        await supabase.from('luxe_listing_users')
            .update({ fb_group: null, fb_link: null })
            .eq('fb_group', group.name);
        const { error } = await supabase.from('luxe_listing_fb_groups').delete().eq('id', group.id);
        if (error) setError('Failed to delete group: ' + error.message);
        else {
            setGroups(prev => prev.filter(g => g.id !== group.id));
            setUsers(prev => prev.map(u => u.fb_group === group.name ? { ...u, fb_group: undefined, fb_link: undefined } : u));
            showSuccess(`Deleted group "${group.name}"`);
        }
        setConfirmDeleteGroup(null);
        setDeletingGroup(null);
    }

    function handleGroupSelect(groupName: string, groupSetter: (name: string) => void) {
        groupSetter(groupName);
    }

    // ── Permissions ────────────────────────────────────────────────────────────
    async function fetchPermissions() {
        setPermsLoading(true);
        const { data, error } = await supabase.from('luxe_listing_role_permissions').select('role, feature, enabled');
        if (error) setError('Failed to load permissions: ' + error.message);
        else if (data) {
            setPerms(prev => {
                const next = { ...prev };
                for (const row of data) {
                    let roleStr = (row.role as string).toUpperCase();
                    if (roleStr === 'VIEWER') roleStr = 'V1';
                    const role = roleStr as AppRole;
                    const feature = row.feature as Feature;
                    if (next[feature] && ROLES.includes(role)) {
                        next[feature] = { ...next[feature], [role]: row.enabled };
                    }
                }
                return next;
            });
        }
        setPermsLoading(false);
    }

    async function handlePermToggle(feature: Feature, role: AppRole) {
        const key = `${feature}-${role}`;
        const newVal = !perms[feature][role];
        setPerms(prev => ({ ...prev, [feature]: { ...prev[feature], [role]: newVal } }));
        setSavingPerm(key);
        setError(null);
        const { error } = await supabase.from('luxe_listing_role_permissions')
            .upsert({ role, feature, enabled: newVal }, { onConflict: 'role,feature' });
        if (error) {
            setPerms(prev => ({ ...prev, [feature]: { ...prev[feature], [role]: !newVal } }));
            setError('Failed to save: ' + error.message);
        } else {
            showSuccess(`${feature} → ${role}: ${newVal ? 'ON' : 'OFF'}`);
        }
        setSavingPerm(null);
    }

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="px-5 pt-4 pb-0 border-b border-gray-100 rounded-t-2xl flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        {/* Tabs */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                    activeTab === 'users' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                <Users size={15} />
                                Users
                            </button>
                            <button
                                onClick={() => setActiveTab('groups')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                    activeTab === 'groups' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                <Link2 size={15} />
                                Groups
                            </button>
                            <button
                                onClick={() => setActiveTab('permissions')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                                    activeTab === 'permissions' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                <Shield size={15} />
                                Permissions
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Add User button — only on Users tab */}
                            {activeTab === 'users' && (
                                <button
                                    onClick={() => { setShowAddForm(v => !v); setEditingEmail(null); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <Plus size={15} />
                                    Add User
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status messages */}
                {(error || successMsg) && (
                    <div className={`mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm flex-shrink-0 ${
                        error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
                    }`}>
                        {error ? <AlertCircle size={15} className="flex-shrink-0" /> : <Check size={15} className="flex-shrink-0" />}
                        {error || successMsg}
                    </div>
                )}

                {/* ── USERS TAB ── */}
                {activeTab === 'users' && (
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* Add User form (inline) */}
                        {showAddForm && (
                            <form onSubmit={handleAddUser} className="mx-4 mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 flex-shrink-0">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">New User</p>
                                <div className="flex flex-wrap gap-2 items-end">
                                    <div className="flex-1 min-w-[160px]">
                                        <label className="block text-xs text-gray-500 mb-1">Email *</label>
                                        <input
                                            type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                            placeholder="user@email.com" required autoFocus
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-[130px]">
                                        <label className="block text-xs text-gray-500 mb-1">Name</label>
                                        <input
                                            type="text" value={newName} onChange={e => setNewName(e.target.value)}
                                            placeholder="Display name"
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Role</label>
                                        <select
                                            value={newRole} onChange={e => setNewRole(e.target.value as AppRole)}
                                            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                                        >
                                            <option value="ADMIN">ADMIN</option>
                                            <option value="EDITOR">EDITOR</option>
                                            <option value="BROKER">BROKER</option>
                                            <option value="V1">V1</option>
                                            <option value="V2">V2</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Group</label>
                                        <select
                                            value={newFbGroup}
                                            onChange={e => handleGroupSelect(e.target.value, setNewFbGroup)}
                                            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                                        >
                                            <option value="">(no group)</option>
                                            {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="submit" disabled={addingUser || !newEmail.trim()}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                        >
                                            {addingUser ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                            Add
                                        </button>
                                        <button
                                            type="button" onClick={() => setShowAddForm(false)}
                                            className="px-4 py-2 text-sm text-gray-500 font-bold rounded-lg hover:bg-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Table */}
                        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                            {usersLoading ? (
                                <div className="flex items-center justify-center py-16 text-gray-400">
                                    <Loader2 size={22} className="animate-spin mr-2" /> Loading users…
                                </div>
                            ) : users.length === 0 ? (
                                <p className="text-center text-gray-400 py-16">No users found.</p>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 bg-white z-10">
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                                            <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
                                            <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                                            <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Group</th>
                                            {isSuperAdmin && <th className="text-center px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Logins</th>}
                                            {isSuperAdmin && <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Last Login</th>}
                                            <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {users.map(u => (
                                            <tr key={u.email} className={`hover:bg-gray-50/60 transition-colors ${editingEmail === u.email ? 'bg-blue-50/40' : ''}`}>
                                                {editingEmail === u.email ? (
                                                    /* ── Edit row ── */
                                                    <>
                                                        <td className="px-5 py-2.5">
                                                            <input
                                                                value={editName}
                                                                onChange={e => setEditName(e.target.value)}
                                                                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-300 mb-1"
                                                            />
                                                            <select
                                                                value={editFbGroup}
                                                                onChange={e => handleGroupSelect(e.target.value, setEditFbGroup)}
                                                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-300 text-gray-600"
                                                            >
                                                                <option value="">(no group)</option>
                                                                {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="px-5 py-2.5 text-gray-400 text-xs truncate max-w-[160px]">{u.email}</td>
                                                        <td className="px-5 py-2.5">
                                                            <select
                                                                value={MASKED_ROLES_UPPER[u.email.toLowerCase()] || editRole}
                                                                onChange={e => setEditRole(e.target.value as AppRole)}
                                                                disabled={!!MASKED_ROLES_UPPER[u.email.toLowerCase()]}
                                                                className={`text-xs font-bold border rounded-full px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-gray-300 ${!!MASKED_ROLES_UPPER[u.email.toLowerCase()] ? 'bg-gray-50 opacity-100 cursor-not-allowed border-gray-100' : ''}`}
                                                            >
                                                                <option value="ADMIN">ADMIN</option>
                                                                <option value="EDITOR">EDITOR</option>
                                                                <option value="BROKER">BROKER</option>
                                                                <option value="V1">V1</option>
                                                                <option value="V2">V2</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-5 py-2.5" />
                                                        {isSuperAdmin && <td className="px-5 py-2.5" />}
                                                        {isSuperAdmin && <td className="px-5 py-2.5" />}
                                                        <td className="px-5 py-2.5 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => saveEdit(u.email)}
                                                                    disabled={savingUser === u.email}
                                                                    className="text-xs px-3 py-1 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                                >
                                                                    {savingUser === u.email ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                                    Save
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingEmail(null)}
                                                                    className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : confirmDelete === u.email ? (
                                                    /* ── Confirm delete row ── */
                                                    <>
                                                        <td colSpan={isSuperAdmin ? 6 : 4} className="px-5 py-2.5 text-sm text-red-600 font-medium">
                                                            Remove <strong>{u.name || u.email}</strong>? This cannot be undone.
                                                        </td>
                                                        <td className="px-5 py-2.5 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleDelete(u.email)}
                                                                    disabled={deletingUser === u.email}
                                                                    className="text-xs px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                                                >
                                                                    {deletingUser === u.email ? '…' : 'Remove'}
                                                                </button>
                                                                <button
                                                                    onClick={() => setConfirmDelete(null)}
                                                                    className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    /* ── Normal row ── */
                                                    <>
                                                        <td className="px-5 py-3 font-semibold text-gray-800 whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5">
                                                                {u.name || '—'}
                                                                {u.fb_link && (
                                                                    <a href={u.fb_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title={u.fb_link}
                                                                        className="text-[#1877F2] hover:opacity-70 transition-opacity flex-shrink-0">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-gray-400 text-xs truncate max-w-[180px]">{u.email}</td>
                                                        <td className="px-5 py-3">
                                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${ROLE_BADGE[MASKED_ROLES_UPPER[u.email.toLowerCase()] || u.role]}`}>
                                                                {MASKED_ROLES_UPPER[u.email.toLowerCase()] || (u.role === 'SUPERADMIN' ? 'ADMIN' : u.role)}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-gray-400 text-xs truncate max-w-[140px]">
                                                            {u.fb_group ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[11px] font-bold">
                                                                    <Link2 size={10} />
                                                                    {u.fb_group}
                                                                </span>
                                                            ) : '—'}
                                                        </td>
                                                        {isSuperAdmin && (
                                                            <>
                                                                <td className="px-5 py-3 text-center text-xs text-gray-500 font-medium">
                                                                    {u.login_count || 0}
                                                                </td>
                                                                <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                                                                    {u.last_login ? new Date(u.last_login).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-5 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => startEdit(u)}
                                                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => { setConfirmDelete(u.email); setEditingEmail(null); }}
                                                                    className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Remove"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer note */}
                        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
                            <p className="text-[11px] text-gray-400">
                                Administrative accounts are configured via the <code className="font-mono bg-gray-100 px-1 rounded">VITE_SUPERADMIN_EMAILS</code> environment variable and appear in this table as ADMIN.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── GROUPS TAB ── */}
                {activeTab === 'groups' && (
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* Add Group form */}
                        <form onSubmit={handleAddGroup} className="mx-4 mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 flex-shrink-0">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">New Group</p>
                            <div className="flex flex-wrap gap-2 items-end">
                                <div className="flex-1 min-w-[180px]">
                                    <label className="block text-xs text-gray-500 mb-1">Group Name *</label>
                                    <input
                                        type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                                        placeholder="e.g. KIU" required autoFocus
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                                    />
                                </div>
                                <button
                                    type="submit" disabled={addingGroup || !newGroupName.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                    {addingGroup ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    Add
                                </button>
                            </div>
                        </form>

                        {/* Groups table */}
                        <div className="overflow-y-auto flex-1 min-h-0">
                            {groupsLoading ? (
                                <div className="flex items-center justify-center py-16 text-gray-400">
                                    <Loader2 size={22} className="animate-spin mr-2" /> Loading groups…
                                </div>
                            ) : groups.length === 0 ? (
                                <p className="text-center text-gray-400 py-16">No groups yet. Add one above.</p>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 bg-white z-10">
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Group</th>
                                            <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {groups.map(g => (
                                            <tr key={g.id} className={`hover:bg-gray-50/60 transition-colors ${editingGroupId === g.id ? 'bg-blue-50/40' : ''}`}>
                                                {editingGroupId === g.id ? (
                                                    <td colSpan={2} className="px-5 py-4">
                                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Group Name *</label>
                                                                <input value={editGroupName} onChange={e => setEditGroupName(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Brand Name (header)</label>
                                                                <input value={editBrandName} onChange={e => setEditBrandName(e.target.value)} placeholder="e.g. Luxe Realty Ph" className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Spearheaded by:</label>
                                                                <input value={editSpearheadedBy} onChange={e => setEditSpearheadedBy(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Logo URL (header)</label>
                                                                <input value={editLogoUrl} onChange={e => setEditLogoUrl(e.target.value)} placeholder="https://..." className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Facebook URL</label>
                                                                <input value={editFacebookUrl} onChange={e => setEditFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Messenger URL</label>
                                                                <input value={editMessengerUrl} onChange={e => setEditMessengerUrl(e.target.value)} placeholder="https://messenger.com/t/..." className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Instagram URL</label>
                                                                <input value={editInstagramUrl} onChange={e => setEditInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">TikTok URL</label>
                                                                <input value={editTiktokUrl} onChange={e => setEditTiktokUrl(e.target.value)} placeholder="https://tiktok.com/@..." className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">YouTube URL</label>
                                                                <input value={editYoutubeUrl} onChange={e => setEditYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@..." className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => saveGroupEdit(g.id)}
                                                                disabled={savingGroup === g.id}
                                                                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg font-bold hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                {savingGroup === g.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                                Save
                                                            </button>
                                                            <button onClick={() => setEditingGroupId(null)} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200">Cancel</button>
                                                        </div>
                                                    </td>
                                                ) : confirmDeleteGroup === g.id ? (
                                                    <>
                                                        <td colSpan={2} className="px-5 py-2.5 text-sm text-red-600 font-medium">
                                                            Delete <strong>{g.name}</strong>? Users in this group will lose their FB link.
                                                        </td>
                                                        <td className="px-5 py-2.5 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleDeleteGroup(g)}
                                                                    disabled={deletingGroup === g.id}
                                                                    className="text-xs px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
                                                                >
                                                                    {deletingGroup === g.id ? '…' : 'Delete'}
                                                                </button>
                                                                <button onClick={() => setConfirmDeleteGroup(null)} className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200">Cancel</button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-5 py-3 font-semibold text-gray-800">
                                                            <div className="flex items-center gap-2">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[12px] font-bold">
                                                                    <Link2 size={11} />
                                                                    {g.name}
                                                                </span>
                                                                {g.brand_name && <span className="text-[11px] text-gray-400">{g.brand_name}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => { setEditingGroupId(g.id); setEditGroupName(g.name); setEditGroupFbLink(g.fb_link); setEditBrandName(g.brand_name ?? ''); setEditLogoUrl(g.logo_url ?? ''); setEditFacebookUrl(g.fb_link ?? ''); setEditMessengerUrl(g.messenger_url ?? ''); setEditInstagramUrl(g.instagram_url ?? ''); setEditTiktokUrl(g.tiktok_url ?? ''); setEditYoutubeUrl(g.youtube_url ?? ''); setEditSpearheadedBy(g.spearheaded_by ?? ''); setConfirmDeleteGroup(null); }}
                                                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => { setConfirmDeleteGroup(g.id); setEditingGroupId(null); }}
                                                                    className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
                            <p className="text-[11px] text-gray-400">
                                Users assigned to a group will see the Facebook button on listings that have a value in <code className="font-mono bg-gray-100 px-1 rounded">FB LINK</code> (Col Z). Users with no group see no Facebook buttons.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── PERMISSIONS TAB ── */}
                {activeTab === 'permissions' && (
                    <div className="flex flex-col flex-1 min-h-0">
                        <div className="overflow-y-auto flex-1">
                            {permsLoading ? (
                                <div className="flex items-center justify-center py-16 text-gray-400">
                                    <Loader2 size={22} className="animate-spin mr-2" /> Loading permissions…
                                </div>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_#f3f4f6]">
                                        <tr>
                                            <th className="text-left px-5 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest w-[40%]">Feature</th>
                                            {visibleRoles.map(role => (
                                                <th key={role} className="px-3 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-2xl text-[11px] font-extrabold uppercase tracking-wider ${ROLE_BADGE[role]}`}>
                                                        {role}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {FEATURE_GROUPS.map(group => (
                                            <React.Fragment key={group}>
                                                <tr>
                                                    <td colSpan={1 + visibleRoles.length} className="px-5 pt-5 pb-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.18em] bg-white">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-px flex-1 bg-gray-100" />
                                                            <span>{group}</span>
                                                            <div className="h-px flex-1 bg-gray-100" />
                                                        </div>
                                                    </td>
                                                </tr>
                                                {FEATURES.filter(f => {
                                                    if (f.group !== group) return false;
                                                    // Superadmins see all rows
                                                    if (isSuperAdmin) return true;
                                                    // Others only see rows for features they have permission for
                                                    return perms[f.key]?.[currentRole] !== false;
                                                }).map(f => (
                                                    <tr key={f.key} className="hover:bg-gray-50/70 transition-colors">
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-gray-800 text-[13px]">{f.label}</span>
                                                                {f.active && (
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">Active</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {visibleRoles.map(role => {
                                                            const key = `${f.key}-${role}`;
                                                            const isDefault = ROLE_DEFAULTS[role][f.key] === perms[f.key][role];
                                                            return (
                                                                <td key={role} className="px-3 py-3.5 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {savingPerm === key ? (
                                                                            <Loader2 size={14} className="animate-spin text-gray-400" />
                                                                        ) : (
                                                                            <Toggle
                                                                                enabled={perms[f.key][role]}
                                                                                onChange={() => handlePermToggle(f.key, role)}
                                                                                color={ROLE_TOGGLE_COLORS[role]}
                                                                            />
                                                                        )}
                                                                        {!isDefault && <span className="text-[8px] text-amber-500 font-bold" title="Overrides default">★</span>}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400 flex-shrink-0">
                            <span><span className="text-amber-500 font-bold">★</span> Overrides code default</span>
                            <span><span className="text-blue-500 font-bold border border-blue-100 bg-blue-50 px-1 rounded">Active</span> = wired up in this app</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
