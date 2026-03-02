import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { clearCache } from '../services/listingsCache';

export type Role = 'superadmin' | 'admin' | 'broker' | 'viewer' | null;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    role: Role;
    isLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchRole(email: string): Promise<Role> {
    console.log('Auth: fetching role for', email);

    // Check SUPERADMIN env var first (bypasses DB, same as LUXE Edit)
    const saEmails = (import.meta.env.VITE_SUPERADMIN_EMAILS || '')
        .split(',')
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);
    if (saEmails.includes(email.toLowerCase())) return 'superadmin';

    const { data, error } = await supabase
        .from('luxe_listing_users')
        .select('role')
        .eq('email', email)
        .maybeSingle();

    console.log('Auth: fetchRole response', { data, error });
    if (error || !data) return null;

    const r = (data.role as string).toUpperCase();
    if (r === 'ADMIN') return 'admin';
    if (r === 'BROKER') return 'broker';
    if (r === 'VIEWER') return 'viewer';
    return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Listen for auth state changes — keep this lightweight (no API calls)
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('Auth: getSession result', session?.user?.email ?? 'no session');
            setSession(session);
            setUser(session?.user ?? null);
            if (!session) setIsLoading(false);
        }).catch(err => {
            console.error('Auth: getSession failed', err);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                console.log('Auth: state changed', _event, session?.user?.email ?? 'no session');
                setSession(session);
                setUser(session?.user ?? null);
                if (!session) {
                    setRole(null);
                    setIsLoading(false);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Fetch role separately — runs after user state is set, outside the auth callback
    useEffect(() => {
        if (!user?.email) return;
        let cancelled = false;

        console.log('Auth: fetching role (separate effect) for', user.email);
        fetchRole(user.email).then(r => {
            if (cancelled) return;
            console.log('Auth: role =', r);
            setRole(r);
            setIsLoading(false);
        }).catch(err => {
            if (cancelled) return;
            console.error('Auth: fetchRole failed', err);
            setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, [user?.email]);

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
    };

    const signOut = async () => {
        await clearCache();
        await supabase.auth.signOut();
        setRole(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, role, isLoading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
