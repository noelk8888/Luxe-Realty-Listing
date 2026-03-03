import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { clearCache } from '../services/listingsCache';

export type Role = 'superadmin' | 'admin' | 'editor' | 'broker' | 'viewer' | null;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    role: Role;
    fbLink: string | null;
    fbGroup: string | null;
    isLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(email: string): Promise<{ role: Role; fbLink: string | null; fbGroup: string | null }> {
    console.log('Auth: fetching profile for', email);

    // Check SUPERADMIN env var first (bypasses DB, same as LUXE Edit)
    const saEmails = (import.meta.env.VITE_SUPERADMIN_EMAILS || '')
        .split(',')
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);
    if (saEmails.includes(email.toLowerCase())) {
        const { data: saData } = await supabase
            .from('luxe_listing_users')
            .select('fb_link, fb_group')
            .eq('email', email.toLowerCase())
            .maybeSingle();
        const d = saData as { fb_link?: string | null; fb_group?: string | null } | null;
        return { role: 'superadmin', fbLink: d?.fb_link ?? null, fbGroup: d?.fb_group ?? null };
    }

    const { data, error } = await supabase
        .from('luxe_listing_users')
        .select('role, fb_link, fb_group')
        .eq('email', email)
        .maybeSingle();

    console.log('Auth: fetchUserProfile response', { data, error });
    if (error || !data) return { role: null, fbLink: null, fbGroup: null };

    const r = (data.role as string).toUpperCase();
    let role: Role = null;
    if (r === 'ADMIN')  role = 'admin';
    else if (r === 'EDITOR') role = 'editor';
    else if (r === 'BROKER') role = 'broker';
    else if (r === 'VIEWER') role = 'viewer';

    const d = data as { fb_link?: string | null; fb_group?: string | null };
    return { role, fbLink: d.fb_link ?? null, fbGroup: d.fb_group ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [fbLink, setFbLink] = useState<string | null>(null);
    const [fbGroup, setFbGroup] = useState<string | null>(null);
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

    // Fetch user profile separately — runs after user state is set, outside the auth callback
    useEffect(() => {
        if (!user?.email) return;
        let cancelled = false;

        console.log('Auth: fetching profile (separate effect) for', user.email);
        fetchUserProfile(user.email).then(({ role: r, fbLink: fb, fbGroup: fg }) => {
            if (cancelled) return;
            console.log('Auth: role =', r, 'fbLink =', fb, 'fbGroup =', fg);
            setRole(r);
            setFbLink(fb);
            setFbGroup(fg);
            setIsLoading(false);
        }).catch((err: unknown) => {
            if (cancelled) return;
            console.error('Auth: fetchUserProfile failed', err);
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
        setFbLink(null);
        setFbGroup(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, role, fbLink, fbGroup, isLoading, signInWithGoogle, signOut }}>
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
