import { useState, useEffect } from 'react';


export const ScrollToTop = () => {
    const [isVisible, setIsVisible] = useState(false);

    // Toggle visibility based on scroll position
    const toggleVisibility = () => {
        if (window.scrollY > 300) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    };

    // Scroll to top smoothly
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    useEffect(() => {
        window.addEventListener('scroll', toggleVisibility);
        return () => {
            window.removeEventListener('scroll', toggleVisibility);
        };
    }, []);

    return (
        <>
            {isVisible && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 z-[9999] flex flex-col items-center justify-center p-0 bg-transparent border-none outline-none group transition-all duration-300 hover:scale-110 active:scale-95"
                    aria-label="Scroll to top"
                >
                    <div className="w-16 h-16 rounded-full overflow-hidden relative bg-white flex items-center justify-center shadow-xl border border-gray-100 group-hover:shadow-2xl transition-shadow duration-300">
                        <img
                            src="/scroll-to-top.png"
                            alt="Back to top"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-800 bg-white/95 px-2.5 py-1 rounded-lg shadow-md backdrop-blur-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Back to Top
                    </span>
                </button>
            )}
        </>
    );
};
