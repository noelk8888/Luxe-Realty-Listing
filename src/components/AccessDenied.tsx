import type React from 'react';

interface AccessDeniedProps {
    email: string;
    onSignOut: () => Promise<void>;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ email, onSignOut }) => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-md text-center space-y-6">
                <div className="flex flex-col items-center gap-3">
                    <img
                        src="/footer-logo.png"
                        alt="Kiu Realty Logo"
                        className="h-12 w-auto"
                    />
                    <h1 className="font-bold text-gray-900 text-2xl tracking-tight">
                        Access Denied
                    </h1>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-3">
                    <p className="text-gray-600 text-sm">
                        The account <span className="font-semibold text-gray-900">{email}</span> is
                        not authorized to access this dashboard.
                    </p>
                    <p className="text-gray-400 text-xs">
                        Contact your administrator to request access.
                    </p>
                </div>
                <button
                    onClick={onSignOut}
                    className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
};
