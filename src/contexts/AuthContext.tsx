import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { clearCache } from '../services/listingsCache';

export type Role = 'superadmin' | 'admin' | 'editor' | 'broker' | 'v1' | 'v2' | null;

export interface GroupBranding {
    brandName: string | null;
    logoUrl: string | null;
    messengerUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    youtubeUrl: string | null;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    role: Role;
    displayRole: Role;
    fbLink: string | null;
    fbGroup: string | null;
    userName: string | null;
    groupBranding: GroupBranding | null;
    isLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hardcoded list of users who are always superadmins (as secondary fallback)
const SUPERADMIN_EMAILS = [
    'noelkiu@gmail.com',
    'lesliekiudmd@yahoo.com',
    'leslie@luxerealtyph.com',
    'louiekiu@gmail.com'
];

// Mapping for what to SHOW in the UI for certain users
const MASKED_ROLES: Record<string, Role> = {
    'noelkiu@gmail.com': 'admin',
    'lesliekiudmd@yahoo.com': 'broker',
    'leslie@luxerealtyph.com': 'broker',
    'louiekiu@gmail.com': 'broker',
};

async function fetchUserProfile(email: string): Promise<{ role: Role; displayRole: Role; fbLink: string | null; fbGroup: string | null; userName: string | null }> {
    console.log('Auth: fetching profile for', email);
    const lowEmail = email.toLowerCase();

    const { data, error } = await supabase
        .from('luxe_listing_users')
        .select('role, fb_link, fb_group, name')
        .eq('email', lowEmail)
        .maybeSingle();

    console.log('Auth: fetchUserProfile response', { data, error });
    
    // If there's an actual error (not just "no data"), log it
    if (error) console.error('Auth: profile fetch error', error);

    const dbRole = (data?.role as string || '').toUpperCase();
    
    // Calculate Internal Role
    // Default to null (Access Denied) if email is not in the approved users table
    let role: Role = data ? 'v1' : null;
    if (dbRole === 'ADMIN') role = 'admin';
    else if (dbRole === 'SUPERADMIN') role = 'superadmin';
    else if (dbRole === 'EDITOR') role = 'editor';
    else if (dbRole === 'BROKER') role = 'broker';
    else if (dbRole === 'V2') role = 'v2';

    // Elevation via hardcoded list or env var
    const saEmailsEnv = (import.meta.env.VITE_SUPERADMIN_EMAILS || '')
        .split(',')
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);
    
    if (SUPERADMIN_EMAILS.includes(lowEmail) || saEmailsEnv.includes(lowEmail)) {
        role = 'superadmin';
    }

    // Calculate Display Role (Masking)
    let displayRole = role;
    if (MASKED_ROLES[lowEmail]) {
        displayRole = MASKED_ROLES[lowEmail];
    } else if (role === 'superadmin') {
        // Always show superadmin as admin (unless already masked above)
        displayRole = 'admin';
    }

    return { role, displayRole, fbLink: data?.fb_link ?? null, fbGroup: data?.fb_group ?? null, userName: data?.name ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [displayRole, setDisplayRole] = useState<Role>(null);
    const [fbLink, setFbLink] = useState<string | null>(null);
    const [fbGroup, setFbGroup] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [groupBranding, setGroupBranding] = useState<GroupBranding | null>(null);
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
        fetchUserProfile(user.email).then(async ({ role: r, displayRole: dr, fbLink: fb, fbGroup: fg, userName: un }) => {
            if (cancelled) return;
            console.log('Auth: role =', r, 'displayRole =', dr, 'fbLink =', fb, 'fbGroup =', fg, 'userName =', un);
            setRole(r);
            setDisplayRole(dr);
            setFbLink(fb);
            setFbGroup(fg);
            setUserName(un);

            if (fg) {
                const { data: gData } = await supabase
                    .from('luxe_listing_fb_groups')
                    .select('brand_name, logo_url, messenger_url, fb_link, instagram_url, tiktok_url, youtube_url')
                    .eq('name', fg)
                    .maybeSingle();
                if (!cancelled && gData) {
                    const g = gData as Record<string, string | null>;
                    setGroupBranding({
                        brandName: g['brand_name'] ?? null,
                        logoUrl: g['logo_url'] ?? null,
                        messengerUrl: g['messenger_url'] ?? null,
                        facebookUrl: g['fb_link'] ?? null,
                        instagramUrl: g['instagram_url'] ?? null,
                        tiktokUrl: g['tiktok_url'] ?? null,
                        youtubeUrl: g['youtube_url'] ?? null,
                    });
                }
            }

            if (!cancelled) setIsLoading(false);
        }).catch((err: unknown) => {
            if (cancelled) return;
            console.error('Auth: fetchUserProfile failed', err);
            setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, [user?.email]);

    const signInWithGoogle = async () => {
        // Clear stale Supabase PKCE / OAuth artifacts left over from an expired session.
        // Without this, Google rejects the next login attempt with a 400 "malformed request"
        // because it receives a code_verifier / state that no longer matches a valid flow.
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') || key.startsWith('supabase.auth') || key.startsWith('pkce-')) {
                localStorage.removeItem(key);
            }
        });

        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: { prompt: 'select_account' },
            },
        });
    };

    const signOut = async () => {
        try {
            // Don't await clearCache to prevent potential IndexedDB hangs from blocking signout
            clearCache().catch(() => { });
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            // Force local state clear immediately to be snappy
            setUser(null);
            setSession(null);
            setRole(null);
            setDisplayRole(null);
            setFbLink(null);
            setFbGroup(null);
            setUserName(null);
            setGroupBranding(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, session, role, displayRole, fbLink, fbGroup, userName, groupBranding, isLoading, signInWithGoogle, signOut }}>
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
