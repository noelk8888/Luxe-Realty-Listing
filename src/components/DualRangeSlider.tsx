import React, { useState, useEffect, useRef } from 'react';

interface DualRangeSliderProps {
    min: number;
    max: number;
    step?: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    formatMinValue?: (val: number) => string;
    formatMaxValue?: (val: number) => string;
    useLogScale?: boolean;
}

interface EditableLabelProps {
    value: number;
    format?: (val: number) => string;
    onCommit: (val: number) => void;
}

const EditableLabel: React.FC<EditableLabelProps> = ({ value, format, onCommit }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempVal, setTempVal] = useState(value.toString());

    useEffect(() => {
        setTempVal(value.toString());
    }, [value]);

    const handleCommit = () => {
        const newVal = parseFloat(tempVal);
        if (isNaN(newVal)) {
            setIsEditing(false);
            setTempVal(value.toString());
            return;
        }
        onCommit(newVal);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={tempVal}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setTempVal(e.target.value)}
                onBlur={handleCommit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommit();
                    if (e.key === 'Escape') {
                        setTempVal(value.toString());
                        setIsEditing(false);
                    }
                }}
                className="w-24 p-1 text-sm font-mono border-2 border-blue-500 rounded bg-white text-gray-900 shadow-lg outline-none text-center z-50"
            />
        );
    }

    return (
        <span
            onClick={() => setIsEditing(true)}
            className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 px-2 py-0.5 rounded transition-all select-none border border-transparent hover:border-blue-200"
            title="Click to edit value"
        >
            {format ? format(value) : value}
        </span>
    );
};

export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
    min,
    max,
    step = 1,
    value,
    onChange,
    formatMinValue,
    formatMaxValue,
    useLogScale = false
}) => {
    const [minVal, setMinVal] = useState(value[0]);
    const [maxVal, setMaxVal] = useState(value[1]);
    const minValRef = useRef(value[0]);
    const maxValRef = useRef(value[1]);
    const range = useRef<HTMLDivElement>(null);

    // Constant for log scale "steepness"
    const K = 8;

    // Convert value to percentage [0-100]
    const getPercent = (val: number) => {
        if (useLogScale) {
            // Reverse mapping for log scale
            const normalized = (val - min) / (max - min);
            const p = (Math.log(1 + normalized * (Math.exp(K) - 1)) / K) * 100;
            return Math.min(100, Math.max(0, p));
        }
        return ((val - min) / (max - min)) * 100;
    };

    // Convert percentage [0-100] back to value
    const toValue = (percent: number) => {
        if (useLogScale) {
            const normalized = (Math.exp((percent / 100) * K) - 1) / (Math.exp(K) - 1);
            const val = normalized * (max - min) + min;
            // Round to step
            return Math.round(val / (step || 1)) * (step || 1);
        }
        return (percent / 100) * (max - min) + min;
    };

    // Values for range inputs
    const rangeInputMin = useLogScale ? 0 : min;
    const rangeInputMax = useLogScale ? 100 : max;
    const rangeInputStep = useLogScale ? 0.01 : step;

    const currentMinInputVal = useLogScale ? getPercent(minVal) : minVal;
    const currentMaxInputVal = useLogScale ? getPercent(maxVal) : maxVal;

    // Sync state with props
    useEffect(() => {
        setMinVal(value[0]);
        setMaxVal(value[1]);
        minValRef.current = value[0];
        maxValRef.current = value[1];
    }, [value, min, max]); // Removed extra deps to match original simpler behavior initially, but useLogScale might need careful ref updates?
    // Actually, following the reference:
    /*
    useEffect(() => {
        if (value[0] !== minValRef.current || value[1] !== maxValRef.current) {
            setMinVal(value[0]);
            setMaxVal(value[1]);
            minValRef.current = value[0];
            maxValRef.current = value[1];
        }
    }, [value]);
    */
    // I will stick to the reference implementation logic for syncing:

    useEffect(() => {
        // Sync internal state if props change significantly
        // Note: checking refs avoids loop if parent updates on every change
        if (value[0] !== minValRef.current || value[1] !== maxValRef.current) {
            setMinVal(value[0]);
            setMaxVal(value[1]);
            minValRef.current = value[0];
            maxValRef.current = value[1];
        }
    }, [value]);


    // Update range track visual
    useEffect(() => {
        const minPercent = getPercent(minVal);
        const maxPercent = getPercent(maxValRef.current);

        if (range.current) {
            range.current.style.left = `${minPercent}%`;
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [minVal, min, max, useLogScale]);

    useEffect(() => {
        const minPercent = getPercent(minValRef.current);
        const maxPercent = getPercent(maxVal);

        if (range.current) {
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [maxVal, min, max, useLogScale]);

    const updateMin = (newVal: number) => {
        let val = newVal;
        // Constraints
        val = Math.max(val, min); // limitMin
        val = Math.min(val, max); // limitMax

        // Cross-check
        // We generally want min <= max - step
        // Or at least min <= maxVal
        val = Math.min(val, maxVal - (step || 1));

        setMinVal(val);
        minValRef.current = val;
        onChange([val, maxVal]);
    };

    const updateMax = (newVal: number) => {
        let val = newVal;
        // Constraints
        val = Math.max(val, min);
        val = Math.min(val, max);

        // Cross-check
        val = Math.max(val, minVal + (step || 1));

        setMaxVal(val);
        maxValRef.current = val;
        onChange([minVal, val]);
    };

    return (
        <div className="flex flex-col w-full gap-2">
            <div className="flex justify-between items-center px-1">
                <EditableLabel
                    value={minVal}
                    format={formatMinValue}
                    onCommit={updateMin}
                />
                <EditableLabel
                    value={maxVal}
                    format={formatMaxValue}
                    onCommit={updateMax}
                />
            </div>

            <div className="relative w-full h-6 flex items-center select-none pt-2">
                {/* Track Background - using two range inputs for thumb controls */}
                <input
                    type="range"
                    min={rangeInputMin}
                    max={rangeInputMax}
                    step={rangeInputStep}
                    value={currentMinInputVal}
                    onChange={(event) => {
                        const rawVal = Number(event.target.value);
                        const val = useLogScale ? toValue(rawVal) : Math.max(rawVal, min);

                        // Prevent crossing
                        const newVal = Math.min(val, maxVal - (step || 1));

                        setMinVal(newVal);
                        minValRef.current = newVal;
                        onChange([newVal, maxVal]);
                    }}
                    className="thumb thumb--left w-full absolute z-30 h-0 outline-none pointer-events-none appearance-none"
                    style={{ zIndex: (minVal - min) / (max - min) > 0.9 ? 5 : 3 }}
                />
                <input
                    type="range"
                    min={rangeInputMin}
                    max={rangeInputMax}
                    step={rangeInputStep}
                    value={currentMaxInputVal}
                    onChange={(event) => {
                        const rawVal = Number(event.target.value);
                        const val = useLogScale ? toValue(rawVal) : Math.min(rawVal, max);

                        // Prevent crossing
                        const newVal = Math.max(val, minVal + (step || 1));

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


