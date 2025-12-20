import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ReCAPTCHA from "react-google-recaptcha";

interface ContactFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedListings: string[];
    initialSuggestedEdit?: string;
}

export const ContactFormModal: React.FC<ContactFormModalProps> = ({
    isOpen,
    onClose,
    selectedListings,
    initialSuggestedEdit = '',
}) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        viberNumber: '',
        buyerType: 'Direct Buyer' as 'Broker' | 'Direct Buyer',
        additionalQuestions: '',
    });

    // Initialize additionalQuestions with initialSuggestedEdit when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData(prev => ({
                ...prev,
                additionalQuestions: initialSuggestedEdit
            }));
        }
    }, [isOpen, initialSuggestedEdit]);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
    const [captchaError, setCaptchaError] = useState('');

    // Reset captcha on close
    useEffect(() => {
        if (!isOpen) {
            setRecaptchaToken(null);
            setCaptchaError('');
            setSubmitStatus('idle');
        }
    }, [isOpen]);

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Name validation
        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }





        // reCAPTCHA validation
        if (!recaptchaToken) {
            setCaptchaError('Please complete the security check.');
            return false;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus('idle');

        // Google Form Submission Logic
        // Form: 'Luxe Suggested Notes/Comments'
        const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/u/0/d/e/1FAIpQLScsBzxO6PgWWJjDVf4rd1uXHiwQZlFYHOMTkg4jk-IxGPtOWg/formResponse";

        const formBody = new FormData();
        // Mapping fields to Google Form Entry IDs
        formBody.append("entry.524309596", formData.name);
        // Email, Viber, and BuyerType are not present in the new form
        // formBody.append("entry.1794044649", formData.email);
        // formBody.append("entry.739228677", formData.viberNumber);
        // formBody.append("entry.1511942672", formData.buyerType);

        formBody.append("entry.1404259207", selectedListings.join(', '));
        formBody.append("entry.94649554", formData.additionalQuestions);

        try {
            await fetch(GOOGLE_FORM_ACTION_URL, {
                method: "POST",
                mode: "no-cors", // Important for submitting to Google Forms from client-side
                body: formBody
            });

            setSubmitStatus('success');

            // Close modal and reset form after success message
            setTimeout(() => {
                onClose();
                resetForm();
            }, 2000);
        } catch (error) {
            console.error("Form submission error:", error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            viberNumber: '',
            buyerType: 'Direct Buyer',
            additionalQuestions: '',
        });
        setErrors({});
        setSubmitStatus('idle');
        setRecaptchaToken(null);
        setCaptchaError('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <h2 className="text-2xl font-bold text-gray-900">Suggested Edit on NOTES</h2>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {submitStatus === 'success' ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-green-800 mb-2">Suggestion Sent!</h3>
                            <p className="text-gray-600">Thank you for your interest. We will get back to you shortly.</p>
                        </div>
                    ) : (
                        <>
                            {submitStatus === 'error' && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                                    <span className="block sm:inline">Something went wrong. Please try again.</span>
                                </div>
                            )}

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Your Full Name"
                                    disabled={isSubmitting}
                                />
                                {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
                            </div>



                            {/* Selected Listings */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Selected Property
                                </label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                    <p className="text-sm text-gray-600">
                                        {selectedListings.join(', ')}
                                    </p>
                                </div>
                            </div>

                            {/* Additional Questions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Suggested Edits
                                </label>
                                <textarea
                                    value={formData.additionalQuestions}
                                    onChange={(e) => setFormData({ ...formData, additionalQuestions: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Any specific questions about the selected properties..."
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* CAPTCHA */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Security Check <span className="text-red-600">*</span>
                                </label>
                                <div className="flex flex-col gap-2">
                                    <ReCAPTCHA
                                        sitekey="6Ld_jS0sAAAAAJKt-yESQBd90nDTmpYBI4zrRH7N"
                                        onChange={(token) => {
                                            setRecaptchaToken(token);
                                            setCaptchaError('');
                                        }}
                                    />
                                    {captchaError && <p className="text-red-600 text-xs">{captchaError}</p>}
                                </div>
                            </div>



                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full text-white py-3 rounded-lg font-semibold transition-colors
                                ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {isSubmitting ? 'Sending...' : 'Submit FORM'}
                            </button>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
};
