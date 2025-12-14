import React, { useState, useEffect, useRef } from 'react';

interface DualRangeSliderProps {
    min: number;
    max: number;
    step?: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    formatMinValue?: (val: number) => string;
    formatMaxValue?: (val: number) => string;
}

export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({ min, max, step = 1, value, onChange, formatMinValue, formatMaxValue }) => {
    const [minVal, setMinVal] = useState(value[0]);
    const [maxVal, setMaxVal] = useState(value[1]);
    const minValRef = useRef(value[0]);
    const maxValRef = useRef(value[1]);
    const range = useRef<HTMLDivElement>(null);

    // Convert to percentage
    const getPercent = (value: number) => Math.round(((value - min) / (max - min)) * 100);

    // Sync state with props
    useEffect(() => {
        setMinVal(value[0]);
        setMaxVal(value[1]);
        minValRef.current = value[0];
        maxValRef.current = value[1];
    }, [value, min, max]);

    // Update range track visual
    useEffect(() => {
        const minPercent = getPercent(minVal);
        const maxPercent = getPercent(maxValRef.current);

        if (range.current) {
            range.current.style.left = `${minPercent}%`;
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [minVal, min, max]);

    useEffect(() => {
        const minPercent = getPercent(minValRef.current);
        const maxPercent = getPercent(maxVal);

        if (range.current) {
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [maxVal, min, max]);

    return (
        <div className="flex flex-col w-full py-2 px-2 items-center">

            {/* Labels above slider, aligned at ends */}
            <div className="flex justify-between w-full text-sm font-bold text-gray-700 font-mono mb-2">
                <span>{formatMinValue ? formatMinValue(minVal) : minVal}</span>
                <span>{formatMaxValue ? formatMaxValue(maxVal) : maxVal}</span>
            </div>

            <div className="relative w-full h-5 flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={minVal}
                    onChange={(event) => {
                        const value = Math.max(Number(event.target.value), min);
                        // Prevent crossing
                        const newVal = Math.min(value, maxVal - 1);
                        setMinVal(newVal);
                        minValRef.current = newVal;
                        onChange([newVal, maxVal]);
                    }}
                    className="thumb thumb--left w-full absolute z-30 h-0 outline-none pointer-events-none appearance-none"
                    style={{ zIndex: minVal > max - 100 ? 5 : 3 }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={maxVal}
                    onChange={(event) => {
                        const value = Math.min(Number(event.target.value), max);
                        // Prevent crossing
                        const newVal = Math.max(value, minVal + 1);
                        setMaxVal(newVal);
                        maxValRef.current = newVal;
                        onChange([minVal, newVal]);
                    }}
                    className="thumb thumb--right w-full absolute z-40 h-0 outline-none pointer-events-none appearance-none"
                />

                <div className="relative w-full h-1">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-300 rounded-full"></div>
                    <div ref={range} className="absolute top-0 h-1 bg-blue-600 rounded-full"></div>
                </div>
            </div>

            <style>{`
                .thumb::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    -webkit-tap-highlight-color: transparent;
                    pointer-events: all;
                    height: 20px;
                    width: 20px;
                    border-radius: 50%;
                    background-color: #2563eb;
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                    position: relative;
                }
                /* Firefox */
                .thumb::-moz-range-thumb {
                    pointer-events: all;
                    height: 20px;
                    width: 20px;
                    border-radius: 50%;
                    background-color: #2563eb;
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                }
            `}</style>
        </div>
    );
};
