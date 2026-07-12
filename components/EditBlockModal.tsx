import React, { useState, useEffect, useMemo } from 'react';
import { Anesthesiologist, Surgery, TimePeriod, AvailabilityStatus, OnCallAssignment, VacationSchedule, Surgeon } from '../types';
import { CondensedSurgeryBlock } from './ScheduleView';

// Helper functions to determine availability and handle time calculations
const getPeriodForTime = (time: string): TimePeriod | null => {
    if (!time) return null;
    const [hours] = time.split(':').map(Number);
    if (hours >= 7 && hours < 13) {
        return TimePeriod.Morning;
    }
    if (hours >= 13 && hours < 19) {
        return TimePeriod.Afternoon;
    }
    return TimePeriod.Night;
};

const getAvailabilityStatus = (
    anesthesiologist: Anesthesiologist,
    period: TimePeriod,
    date: Date,
    weekendSchedule: { [date: string]: OnCallAssignment[] },
    vacationSchedule: VacationSchedule
): AvailabilityStatus => {
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Vacation check (highest priority, Mon-Fri only)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dateCopy = new Date(date.getTime());
        // Go back to Monday of the current week
        dateCopy.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const weekStartDateStr = dateCopy.toISOString().split('T')[0];

        if (vacationSchedule[weekStartDateStr]?.includes(anesthesiologist.id)) {
            return AvailabilityStatus.Vacation; // On vacation, not available.
        }
    }

    const specificStatus = anesthesiologist.availability[dateString]?.[period];
    if (specificStatus) return specificStatus;

    let weekendStartDateStr: string | null = null;
    if (dayOfWeek === 5) {
        weekendStartDateStr = dateString;
    } else if (dayOfWeek === 6) {
        const friday = new Date(date.getTime() - (1 * 24 * 60 * 60 * 1000));
        weekendStartDateStr = friday.toISOString().split('T')[0];
    } else if (dayOfWeek === 0) {
        const friday = new Date(date.getTime() - (2 * 24 * 60 * 60 * 1000));
        weekendStartDateStr = friday.toISOString().split('T')[0];
    }

    if (weekendStartDateStr && weekendSchedule.hasOwnProperty(weekendStartDateStr)) {
        const isWithinOnCallPeriod = (
            (dayOfWeek === 5 && period === TimePeriod.Night) ||
            dayOfWeek === 6 ||
            dayOfWeek === 0
        );
        if (isWithinOnCallPeriod) {
            const isOnCall = weekendSchedule[weekendStartDateStr].some(a => a.id === anesthesiologist.id);
            return isOnCall ? AvailabilityStatus.Available : AvailabilityStatus.DayOff;
        }
    }

    const defaultStatus = anesthesiologist.defaultAvailability?.[dayOfWeek]?.[period];
    if (defaultStatus) return defaultStatus;

    return AvailabilityStatus.Available;
};

const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

interface EditBlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (blockId: string, updates: { totalEstimatedTime: number, anesthesiologistId: string | null, secondAnesthesiologistId?: string | null }) => void;
    block: CondensedSurgeryBlock;
    anesthesiologists: Anesthesiologist[];
    dailySurgeries: Surgery[];
    weekendOnCallSchedule: { [date: string]: OnCallAssignment[] };
    vacationSchedule: VacationSchedule;
    selectedDate: Date;
    surgeons: Surgeon[];
}

const EditBlockModal: React.FC<EditBlockModalProps> = ({
    isOpen,
    onClose,
    onSave,
    block,
    anesthesiologists,
    dailySurgeries,
    weekendOnCallSchedule,
    vacationSchedule,
    selectedDate,
    surgeons,
}) => {
    const [hours, setHours] = useState('');
    const [minutes, setMinutes] = useState('');
    const [anesthesiologistId, setAnesthesiologistId] = useState<string | null>(null);
    const [secondAnesthesiologistId, setSecondAnesthesiologistId] = useState<string | null>(null);
    const [forceAllocation, setForceAllocation] = useState(false);
    const [showBlocked, setShowBlocked] = useState(false);
    const [addSecondAnesthesiologist, setAddSecondAnesthesiologist] = useState(false);

    const blockName = useMemo(() => {
        return Object.entries(block.procedureCounts)
            .map(([name, count]) => `${count} ${name}${Number(count) > 1 ? 's' : ''}`)
            .join(', ');
    }, [block.procedureCounts]);

    useEffect(() => {
        if (block) {
            setHours(Math.floor(block.totalEstimatedTime / 60).toString());
            setMinutes((block.totalEstimatedTime % 60).toString());
            setAnesthesiologistId(block.anesthesiologistId);
            setSecondAnesthesiologistId(block.secondAnesthesiologistId || null);
            setAddSecondAnesthesiologist(!!block.secondAnesthesiologistId);
        }
    }, [block]);

    const filteredAnesthesiologistsForDropdown = useMemo(() => {
        const startTime = block.startTime;
        if (!startTime) return anesthesiologists.map(a => ({...a, conflictText: ''}));

        const requiredPeriod = getPeriodForTime(startTime);
        if (!requiredPeriod) return anesthesiologists.map(a => ({...a, conflictText: ''}));

        const estimatedTime = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
        const blockSurgeryIds = new Set(block.surgeries.map(s => s.id));
        
        const selectedSurgeon = surgeons.find(s => s.id === block.surgeonId);
        const blockedIds = selectedSurgeon?.blockedAnesthesiologistIds || [];

        const anesthesiologistsWithInfo = anesthesiologists.map(a => {
            const status = getAvailabilityStatus(a, requiredPeriod, selectedDate, weekendOnCallSchedule, vacationSchedule);
            const isAvailable = status === AvailabilityStatus.Available;

            let hasConflict = false;
            if (isAvailable && estimatedTime > 0 && startTime) {
                const blockStartMinutes = timeToMinutes(startTime);
                const blockEndMinutes = blockStartMinutes + estimatedTime;
                const assignedSurgeries = dailySurgeries.filter(s => (s.anesthesiologistId === a.id || s.secondAnesthesiologistId === a.id) && !blockSurgeryIds.has(s.id));
                hasConflict = assignedSurgeries.some(existingSurgery => {
                    if (!existingSurgery.startTime) return false;
                    const existingStartMinutes = timeToMinutes(existingSurgery.startTime);
                    const existingEndMinutes = existingStartMinutes + existingSurgery.estimatedTime;
                    return blockStartMinutes < existingEndMinutes && blockEndMinutes > existingStartMinutes;
                });
            }
            
            const isBlocked = blockedIds.includes(a.id);
            let conflictText = '';
            if (!isAvailable) {
                conflictText = ` (${status})`;
            } else if (hasConflict) {
                conflictText = ' (Conflito!)';
            }

            return { ...a, isAvailable, hasConflict, conflictText, isBlocked };
        });

        let displayList = anesthesiologistsWithInfo;

        if (forceAllocation) {
            displayList = displayList.filter(a => a.isAvailable);
        } else {
            displayList = displayList.filter(a => a.isAvailable && !a.hasConflict);
        }

        if (!showBlocked) {
            displayList = displayList.filter(a => !a.isBlocked);
        }
        
        // Ensure the currently assigned anesthesiologist is always in the list.
        const isCurrentInList = displayList.some(a => a.id === anesthesiologistId);
        if (anesthesiologistId && !isCurrentInList) {
            const currentAnesthesiologistInfo = anesthesiologistsWithInfo.find(a => a.id === anesthesiologistId);
            if (currentAnesthesiologistInfo) {
                displayList.push(currentAnesthesiologistInfo);
            }
        }

        return displayList;
    }, [block, hours, minutes, anesthesiologists, selectedDate, weekendOnCallSchedule, vacationSchedule, dailySurgeries, anesthesiologistId, forceAllocation, showBlocked, surgeons]);

    const filteredSecondAnesthesiologistsForDropdown = useMemo(() => {
        if (!addSecondAnesthesiologist) return [];
        
        const startTime = block.startTime;
        if (!startTime) return [];

        const requiredPeriod = getPeriodForTime(startTime);
        if (!requiredPeriod) return [];

        const estimatedTime = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
        const blockSurgeryIds = new Set(block.surgeries.map(s => s.id));
        
        const selectedSurgeon = surgeons.find(s => s.id === block.surgeonId);
        const blockedIds = selectedSurgeon?.blockedAnesthesiologistIds || [];

        const anesthesiologistsWithInfo = anesthesiologists
            .filter(a => a.id !== anesthesiologistId) // Exclude the primary anesthesiologist
            .map(a => {
                const status = getAvailabilityStatus(a, requiredPeriod, selectedDate, weekendOnCallSchedule, vacationSchedule);
                const isAvailable = status === AvailabilityStatus.Available;

                let hasConflict = false;
                if (isAvailable && estimatedTime > 0 && startTime) {
                    const blockStartMinutes = timeToMinutes(startTime);
                    const blockEndMinutes = blockStartMinutes + estimatedTime;
                    const assignedSurgeries = dailySurgeries.filter(s => 
                        (s.anesthesiologistId === a.id || s.secondAnesthesiologistId === a.id) 
                        && !blockSurgeryIds.has(s.id)
                    );
                    hasConflict = assignedSurgeries.some(existingSurgery => {
                        if (!existingSurgery.startTime) return false;
                        const existingStartMinutes = timeToMinutes(existingSurgery.startTime);
                        const existingEndMinutes = existingStartMinutes + existingSurgery.estimatedTime;
                        return blockStartMinutes < existingEndMinutes && blockEndMinutes > existingStartMinutes;
                    });
                }
                
                const isBlocked = blockedIds.includes(a.id);
                let conflictText = '';
                if (!isAvailable) {
                    conflictText = ` (${status})`;
                } else if (hasConflict) {
                    conflictText = ' (Conflito!)';
                }

                return { ...a, isAvailable, hasConflict, conflictText, isBlocked };
            });

        const displayList = anesthesiologistsWithInfo.filter(a => a.isAvailable && (showBlocked || !a.isBlocked));

        // Ensure the currently assigned second anesthesiologist is always in the list.
        const isCurrentInList = displayList.some(a => a.id === secondAnesthesiologistId);
        if (secondAnesthesiologistId && !isCurrentInList) {
            const currentAnesthesiologistInfo = anesthesiologistsWithInfo.find(a => a.id === secondAnesthesiologistId);
            if (currentAnesthesiologistInfo) {
                displayList.push(currentAnesthesiologistInfo);
            }
        }

        return displayList;
    }, [addSecondAnesthesiologist, block, hours, minutes, anesthesiologists, selectedDate, weekendOnCallSchedule, vacationSchedule, dailySurgeries, anesthesiologistId, secondAnesthesiologistId, showBlocked, surgeons]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const totalEstimatedTime = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
        if (totalEstimatedTime > 0) {
            onSave(block.id, {
                totalEstimatedTime,
                anesthesiologistId,
                secondAnesthesiologistId: addSecondAnesthesiologist ? secondAnesthesiologistId : null,
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Editar Bloco de Exames</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Procedimentos</label>
                        <p className="bg-gray-100 dark:bg-gray-700 p-2.5 rounded-lg text-sm">{blockName}</p>
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Cirurgião</label>
                        <p className="bg-gray-100 dark:bg-gray-700 p-2.5 rounded-lg text-sm">Dr. {block.surgeon}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Horário de Início</label>
                            <p className="bg-gray-100 dark:bg-gray-700 p-2.5 rounded-lg text-sm">{block.startTime || 'N/A'}</p>
                        </div>
                         <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Tempo Total Estimado</label>
                            <div className="flex items-center space-x-2">
                                <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="H" min="0" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="M" min="0" max="59" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                        </div>
                    </div>
                     <div className="space-y-3">
                         <div className="flex flex-wrap gap-2">
                            <div className="flex items-center p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 flex-1 min-w-[150px]">
                                <input 
                                    id="editBlockForceAllocation" 
                                    type="checkbox" 
                                    checked={forceAllocation} 
                                    onChange={(e) => setForceAllocation(e.target.checked)}
                                    className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800"
                                />
                                <label htmlFor="editBlockForceAllocation" className="ml-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                    Sala simultânea
                                </label>
                            </div>
                            <div className="flex items-center p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 flex-1 min-w-[150px]">
                                <input 
                                    id="editBlockShowBlocked" 
                                    type="checkbox" 
                                    checked={showBlocked} 
                                    onChange={(e) => setShowBlocked(e.target.checked)}
                                    className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800"
                                />
                                <label htmlFor="editBlockShowBlocked" className="ml-2 text-sm font-medium text-red-800 dark:text-red-200">
                                    Forçar bloqueados
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center p-2 rounded-md bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/50">
                            <input 
                                id="editBlockAddSecondAnesthesiologist" 
                                type="checkbox" 
                                checked={addSecondAnesthesiologist} 
                                onChange={(e) => {
                                    setAddSecondAnesthesiologist(e.target.checked);
                                    if (!e.target.checked) setSecondAnesthesiologistId(null);
                                }}
                                className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-gray-800"
                            />
                            <label htmlFor="editBlockAddSecondAnesthesiologist" className="ml-2 text-sm font-medium text-sky-800 dark:text-sky-200">
                                Adicionar segundo anestesista
                            </label>
                        </div>
                        <div>
                            <label htmlFor="editAnesthesiologistBlock" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Anestesista Principal</label>
                            <select id="editAnesthesiologistBlock" value={anesthesiologistId || ''} onChange={(e) => setAnesthesiologistId(e.target.value || null)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="">Não Atribuído</option>
                                {filteredAnesthesiologistsForDropdown.map(a => (
                                    <option key={a.id} value={a.id} className={`${a.hasConflict || !a.isAvailable ? 'text-red-600 dark:text-red-400 font-bold' : ''} ${a.isBlocked ? 'italic text-orange-600 dark:text-orange-400' : ''}`}>
                                        {a.name}{a.conflictText}{a.isBlocked ? ' (Bloqueado)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                         {addSecondAnesthesiologist && (
                            <div>
                                <label htmlFor="editSecondAnesthesiologistBlock" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Segundo Anestesista</label>
                                <select id="editSecondAnesthesiologistBlock" value={secondAnesthesiologistId || ''} onChange={(e) => setSecondAnesthesiologistId(e.target.value || null)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="">Nenhum</option>
                                    {filteredSecondAnesthesiologistsForDropdown.map(a => (
                                        <option key={a.id} value={a.id} className={`${a.hasConflict || !a.isAvailable ? 'text-red-600 dark:text-red-400 font-bold' : ''} ${a.isBlocked ? 'italic text-orange-600 dark:text-orange-400' : ''}`}>
                                            {a.name}{a.conflictText}{a.isBlocked ? ' (Bloqueado)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-600"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditBlockModal;
