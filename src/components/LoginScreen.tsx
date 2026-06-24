import React, { useState } from 'react';
import { ShieldAlert, Lock } from 'lucide-react';

interface LoginScreenProps {
    onSignIn: () => Promise<void>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSignIn }) => {
    const [accepted, setAccepted] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col items-center gap-6">
                {/* Header with Logo */}
                <div className="flex flex-col items-center gap-2.5 text-center">
                    <img
                        src="/luxe-logo.png"
                        alt="Luxe Realty Logo"
                        className="h-14 w-auto"
                    />
                    <h1 className="font-bold text-gray-900 text-xl tracking-tight">
                        Luxe Realty Ph
                    </h1>
                </div>

                <div className="w-full border-t border-gray-100"></div>

                {/* Exclusivity Notice */}
                <div className="w-full bg-amber-50/50 border border-amber-100/70 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-2 text-amber-800 mb-2">
                        <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
                        <h2 className="text-xs font-black tracking-wider uppercase">
                            RESTRICTED PORTAL EXCLUSIVITY NOTICE
                        </h2>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-600 font-medium text-left">
                        Welcome. This platform operates as a strictly confidential, closed-network portfolio curated exclusively for a pre-approved and privileged clientele. Access is highly restricted. If you do not possess authorized credentials, or if you were directed here by a broker without an active account, please contact your designated real estate director or our concierge team to initiate the credentialing process.
                    </p>
                </div>

                {/* Confidentiality Agreement */}
                <div className="w-full flex flex-col gap-3">
                    <div className="text-left">
                        <div className="flex items-center gap-2 text-gray-800 mb-1">
                            <Lock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <h2 className="text-xs font-black tracking-wider uppercase">
                                BINDING CONFIDENTIALITY AGREEMENT
                            </h2>
                        </div>
                        <p className="text-xs leading-relaxed text-gray-500">
                            Prior to authentication, you must acknowledge and accept the terms governing this private environment.
                        </p>
                    </div>

                    {/* Checkbox Card */}
                    <label className={`
                        flex items-start gap-3 p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none text-left
                        ${accepted 
                            ? 'bg-blue-50/30 border-blue-200 ring-1 ring-blue-100' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }
                    `}>
                        <div className="flex items-center h-5">
                            <input
                                id="terms-checkbox"
                                type="checkbox"
                                checked={accepted}
                                onChange={(e) => setAccepted(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                        <span className="text-xs leading-relaxed text-gray-600 font-medium">
                            I acknowledge and agree that by authenticating my credentials, I am entering into a legally binding agreement of strict confidentiality. I understand that all real estate listings, financial data, and media contained herein are proprietary and intended for my exclusive review as an authorized recipient. I expressly agree not to disclose, reproduce, distribute, or otherwise share any information from this platform without prior written consent. I further acknowledge that property details and pricing are subject to immediate change without notice.
                        </span>
                    </label>
                </div>

                {/* Sign In Button */}
                <div className="w-full flex flex-col items-center gap-2">
                    <button
                        onClick={onSignIn}
                        disabled={!accepted}
                        className={`
                            w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-200 text-gray-700 font-bold text-sm
                            ${accepted 
                                ? 'hover:shadow-md hover:border-gray-300 hover:bg-gray-50 active:scale-[0.99] cursor-pointer' 
                                : 'opacity-40 cursor-not-allowed'
                            }
                        `}
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Sign in with Google
                    </button>
                    {!accepted && (
                        <p className="text-[10px] text-gray-400 font-medium">
                            Acknowledge the confidentiality agreement above to sign in.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
