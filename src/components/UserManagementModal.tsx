import React, { useEffect, useState } from 'react';
import { X, Users, Plus, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AppRole = 'ADMIN' | 'BROKER' | 'VIEWER';

interface AppUser {
    id?: number;
    email: string;
    name: string;
    role: AppRole;
}

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ROLE_COLORS: Record<AppRole, string> = {
    ADMIN: 'bg-green-50 text-green-700 border-green-200',
    BROKER: 'bg-blue-50 text-blue-700 border-blue-200',
    VIEWER: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null); // email being saved
    const [deleting, setDeleting] = useState<string | null>(null); // email being deleted
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // New user form
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<AppRole>('VIEWER');
    const [addingUser, setAddingUser] = useState(false);

    // Confirm delete
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            fetchUsers();
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    async function fetchUsers() {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from('app_users')
            .select('id, email, name, role')
            .order('role', { ascending: true })
            .order('email', { ascending: true });

        if (error) {
            setError('Failed to load users: ' + error.message);
        } else {
            setUsers((data ?? []).map(u => ({ ...u, role: (u.role as string).toUpperCase() as AppRole })));
        }
        setLoading(false);
    }

    function showSuccess(msg: string) {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    }

    async function handleRoleChange(email: string, newRoleValue: AppRole) {
        setSaving(email);
        setError(null);
        const { error } = await supabase
            .from('app_users')
            .update({ role: newRoleValue })
            .eq('email', email);

        if (error) {
            setError('Failed to update role: ' + error.message);
        } else {
            setUsers(prev => prev.map(u => u.email === email ? { ...u, role: newRoleValue } : u));
            showSuccess(`Role updated for ${email}`);
        }
        setSaving(null);
    }

    async function handleDelete(email: string) {
        setDeleting(email);
        setError(null);
        const { error } = await supabase
            .from('app_users')
            .delete()
            .eq('email', email);

        if (error) {
            setError('Failed to delete user: ' + error.message);
        } else {
            setUsers(prev => prev.filter(u => u.email !== email));
            showSuccess(`Removed ${email}`);
        }
        setConfirmDelete(null);
        setDeleting(null);
    }

    async function handleAddUser(e: React.FormEvent) {
        e.preventDefault();
        const emailTrimmed = newEmail.trim().toLowerCase();
        const nameTrimmed = newName.trim();
        if (!emailTrimmed) return;

        setAddingUser(true);
        setError(null);

        const { error } = await supabase
            .from('app_users')
            .insert({ email: emailTrimmed, name: nameTrimmed || emailTrimmed.split('@')[0], role: newRole });

        if (error) {
            if (error.code === '23505') {
                setError(`${emailTrimmed} is already in the system.`);
            } else {
                setError('Failed to add user: ' + error.message);
            }
        } else {
            setNewEmail('');
            setNewName('');
            setNewRole('VIEWER');
            showSuccess(`Added ${emailTrimmed} as ${newRole}`);
            await fetchUsers();
        }
        setAddingUser(false);
    }

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-green-50/60 rounded-t-2xl flex-shrink-0">
                    <div className="flex items-center gap-2 text-green-800">
                        <Users size={20} />
                        <h3 className="text-lg font-bold">User Management</h3>
                        <span className="text-xs text-green-600 font-medium ml-1">({users.length} users)</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-black/5 rounded-full transition-colors text-gray-500 hover:text-gray-900"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Status messages */}
                {error && (
                    <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex-shrink-0">
                        <AlertCircle size={15} />
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex-shrink-0">
                        <Check size={15} />
                        {successMsg}
                    </div>
                )}

                {/* User list */}
                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-gray-400">
                            <Loader2 size={24} className="animate-spin mr-2" />
                            Loading users…
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-center text-gray-400 py-12">No users found.</p>
                    ) : (
                        <div className="space-y-2">
                            {users.map(u => (
                                <div
                                    key={u.email}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                >
                                    {/* Avatar initial */}
                                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0 uppercase">
                                        {(u.name || u.email)[0]}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{u.name || '—'}</p>
                                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                    </div>

                                    {/* Role selector */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {saving === u.email ? (
                                            <Loader2 size={14} className="animate-spin text-gray-400" />
                                        ) : null}
                                        <select
                                            value={u.role}
                                            onChange={e => handleRoleChange(u.email, e.target.value as AppRole)}
                                            disabled={saving === u.email}
                                            className={`text-xs font-bold border rounded-full px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 ${ROLE_COLORS[u.role]}`}
                                        >
                                            <option value="ADMIN">ADMIN</option>
                                            <option value="BROKER">BROKER</option>
                                            <option value="VIEWER">VIEWER</option>
                                        </select>
                                    </div>

                                    {/* Delete */}
                                    {confirmDelete === u.email ? (
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={() => handleDelete(u.email)}
                                                disabled={deleting === u.email}
                                                className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                            >
                                                {deleting === u.email ? '…' : 'Confirm'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(null)}
                                                className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDelete(u.email)}
                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                            title="Remove user"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add user form */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex-shrink-0">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Add New User</p>
                    <form onSubmit={handleAddUser} className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs text-gray-500 mb-1">Email *</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                placeholder="user@email.com"
                                required
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                            <label className="block text-xs text-gray-500 mb-1">Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Display name"
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Role</label>
                            <select
                                value={newRole}
                                onChange={e => setNewRole(e.target.value as AppRole)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            >
                                <option value="ADMIN">ADMIN</option>
                                <option value="BROKER">BROKER</option>
                                <option value="VIEWER">VIEWER</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={addingUser || !newEmail.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                            {addingUser ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            Add
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
