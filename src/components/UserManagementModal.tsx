import React, { useEffect, useState } from 'react';
import { X, Users, Shield, Plus, Trash2, Loader2, Check, AlertCircle, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Feature } from '../contexts/PermissionsContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type AppRole = 'ADMIN' | 'BROKER' | 'VIEWER';
type Tab = 'users' | 'permissions';

interface AppUser {
    id?: string;
    email: string;
    name: string;
    role: AppRole;
    created_by?: string;
}

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES: AppRole[] = ['ADMIN', 'BROKER', 'VIEWER'];

const ROLE_BADGE: Record<AppRole, string> = {
    ADMIN:  'bg-purple-50 text-purple-700 border border-purple-200',
    BROKER: 'bg-blue-50 text-blue-700 border border-blue-200',
    VIEWER: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const ROLE_TOGGLE_COLORS: Record<AppRole, string> = {
    ADMIN:  'bg-purple-500',
    BROKER: 'bg-blue-500',
    VIEWER: 'bg-gray-400',
};

const FEATURES: { key: Feature; label: string; group: string; active: boolean }[] = [
    { key: 'view_photos',    label: 'View Photos',     group: 'Listing View',    active: true  },
    { key: 'view_pricing',   label: 'View Pricing',    group: 'Listing View',    active: true  },
    { key: 'view_geo_id',    label: 'View GEO ID',     group: 'Listing View',    active: true  },
    { key: 'view_contact',   label: 'View Contact',    group: 'Listing View',    active: false },
    { key: 'edit_listing',   label: 'Edit Listing',    group: 'Listing Actions', active: true  },
    { key: 'add_listing',    label: 'Add Listing',     group: 'Listing Actions', active: false },
    { key: 'delete_listing', label: 'Delete Listing',  group: 'Listing Actions', active: false },
    { key: 'geocoding',      label: 'GPS / Geocoding', group: 'Tools',           active: true  },
    { key: 'ai_extract',     label: 'AI Extract',      group: 'Tools',           active: false },
    { key: 'telegram_send',  label: 'Telegram Send',   group: 'Tools',           active: false },
    { key: 'batch_review',   label: 'Batch Review',    group: 'Tools',           active: false },
    { key: 'export_data',    label: 'Export Data',     group: 'Tools',           active: false },
    { key: 'manage_users',   label: 'Manage Users',    group: 'Admin',           active: false },
];

const FEATURE_GROUPS = ['Listing View', 'Listing Actions', 'Tools', 'Admin'];

const ROLE_DEFAULTS: Record<AppRole, Record<Feature, boolean>> = {
    ADMIN: {
        add_listing: true, edit_listing: true, delete_listing: true,
        telegram_send: true, batch_review: true, ai_extract: true,
        geocoding: true, view_pricing: true, view_contact: true,
        view_geo_id: true, view_photos: true, export_data: true, manage_users: true,
    },
    BROKER: {
        add_listing: true, edit_listing: true, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: true,
        geocoding: true, view_pricing: true, view_contact: true,
        view_geo_id: true, view_photos: true, export_data: false, manage_users: false,
    },
    VIEWER: {
        add_listing: false, edit_listing: false, delete_listing: false,
        telegram_send: false, batch_review: false, ai_extract: false,
        geocoding: false, view_pricing: false, view_contact: false,
        view_geo_id: false, view_photos: true, export_data: false, manage_users: false,
    },
};

type PermState = Record<Feature, Record<AppRole, boolean>>;

function buildDefaultPermState(): PermState {
    const state = {} as PermState;
    for (const f of FEATURES) {
        state[f.key] = {
            ADMIN:  ROLE_DEFAULTS.ADMIN[f.key],
            BROKER: ROLE_DEFAULTS.BROKER[f.key],
            VIEWER: ROLE_DEFAULTS.VIEWER[f.key],
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
    const [activeTab, setActiveTab] = useState<Tab>('users');

    // ── Users tab state
    const [users, setUsers] = useState<AppUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [editingEmail, setEditingEmail] = useState<string | null>(null);
    const [editRole, setEditRole] = useState<AppRole>('VIEWER');
    const [editName, setEditName] = useState('');
    const [savingUser, setSavingUser] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deletingUser, setDeletingUser] = useState<string | null>(null);

    // Add user form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<AppRole>('VIEWER');
    const [addingUser, setAddingUser] = useState(false);

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
        } else {
            document.body.style.overflow = 'unset';
            setError(null);
            setSuccessMsg(null);
            setShowAddForm(false);
            setEditingEmail(null);
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
            .select('id, email, name, role, created_by')
            .order('role').order('name');
        if (error) setError('Failed to load users: ' + error.message);
        else setUsers((data ?? []).map(u => ({ ...u, role: (u.role as string).toUpperCase() as AppRole })));
        setUsersLoading(false);
    }

    function startEdit(u: AppUser) {
        setEditingEmail(u.email);
        setEditRole(u.role);
        setEditName(u.name);
        setConfirmDelete(null);
    }

    async function saveEdit(email: string) {
        setSavingUser(email);
        setError(null);
        const { error } = await supabase.from('luxe_listing_users')
            .update({ role: editRole, name: editName })
            .eq('email', email);
        if (error) setError('Failed to update: ' + error.message);
        else {
            setUsers(prev => prev.map(u => u.email === email ? { ...u, role: editRole, name: editName } : u));
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
        });
        if (error) {
            setError(error.code === '23505' ? `${emailTrimmed} is already in the system.` : 'Failed to add user: ' + error.message);
        } else {
            setNewEmail(''); setNewName(''); setNewRole('VIEWER');
            setShowAddForm(false);
            showSuccess(`Added ${emailTrimmed} as ${newRole}`);
            await fetchUsers();
        }
        setAddingUser(false);
    }

    // ── Permissions ────────────────────────────────────────────────────────────
    async function fetchPermissions() {
        setPermsLoading(true);
        const { data, error } = await supabase.from('role_permissions').select('role, feature, enabled');
        if (error) setError('Failed to load permissions: ' + error.message);
        else if (data) {
            setPerms(prev => {
                const next = { ...prev };
                for (const row of data) {
                    const role = (row.role as string).toUpperCase() as AppRole;
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
        const { error } = await supabase.from('role_permissions')
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
                                            <option value="BROKER">BROKER</option>
                                            <option value="VIEWER">VIEWER</option>
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
                        <div className="overflow-y-auto flex-1 min-h-0">
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
                                            <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Added by</th>
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
                                                                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                                            />
                                                        </td>
                                                        <td className="px-5 py-2.5 text-gray-400 text-xs truncate max-w-[160px]">{u.email}</td>
                                                        <td className="px-5 py-2.5">
                                                            <select
                                                                value={editRole}
                                                                onChange={e => setEditRole(e.target.value as AppRole)}
                                                                className="text-xs font-bold border rounded-full px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                                            >
                                                                <option value="ADMIN">ADMIN</option>
                                                                <option value="BROKER">BROKER</option>
                                                                <option value="VIEWER">VIEWER</option>
                                                            </select>
                                                        </td>
                                                        <td className="px-5 py-2.5 hidden sm:table-cell" />
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
                                                        <td colSpan={4} className="px-5 py-2.5 text-sm text-red-600 font-medium">
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
                                                        <td className="px-5 py-3 font-semibold text-gray-800 whitespace-nowrap">{u.name || '—'}</td>
                                                        <td className="px-5 py-3 text-gray-400 text-xs truncate max-w-[180px]">{u.email}</td>
                                                        <td className="px-5 py-3">
                                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${ROLE_BADGE[u.role]}`}>
                                                                {u.role}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[140px]">
                                                            {u.created_by || '—'}
                                                        </td>
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
                                SUPERADMIN accounts are configured via the <code className="font-mono bg-gray-100 px-1 rounded">VITE_SUPERADMIN_EMAILS</code> environment variable and do not appear in this table.
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
                                    <thead className="sticky top-0 bg-white z-10">
                                        <tr className="border-b border-gray-100">
                                            <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Feature</th>
                                            {ROLES.map(role => (
                                                <th key={role} className="px-4 py-3 text-center">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ROLE_BADGE[role]}`}>
                                                        {role}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {FEATURE_GROUPS.map(group => (
                                            <React.Fragment key={group}>
                                                <tr className="bg-gray-50">
                                                    <td colSpan={4} className="px-5 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                        {group}
                                                    </td>
                                                </tr>
                                                {FEATURES.filter(f => f.group === group).map(f => (
                                                    <tr key={f.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-gray-800">{f.label}</span>
                                                                {f.active && (
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">Active</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {ROLES.map(role => {
                                                            const key = `${f.key}-${role}`;
                                                            const isDefault = ROLE_DEFAULTS[role][f.key] === perms[f.key][role];
                                                            return (
                                                                <td key={role} className="px-4 py-3 text-center">
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
