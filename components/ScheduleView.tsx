import React, { useMemo, useState } from 'react';
import { Anesthesiologist, Surgery, AvailabilityStatus, TimePeriod, OnCallAssignment, VacationSchedule, Surgeon } from '../types';
import { WORKLOAD_DAYS } from '../constants';
import EditSurgeryModal from './EditSurgeryModal';
import ConfirmationModal from './ConfirmationModal';
import EditBlockModal from './EditBlockModal'; // Import the new modal

const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
};

const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

// --- Types for processed items ---
// Fix: Export the CondensedSurgeryBlock interface to be used by the new EditBlockModal.
export interface CondensedSurgeryBlock {
    id: string;
    type: 'condensed';
    surgeon: string;
    surgeonId?: string;
    hospital: string;
    startTime?: string;
    totalEstimatedTime: number;
    procedureCounts: Record<string, number>;
    anesthesiologistId: string | null;
    secondAnesthesiologistId?: string | null;
    surgeries: Surgery[];
}

type ProcessedItem = Surgery & { type?: 'single' } | CondensedSurgeryBlock;


// --- Helper function to process and condense surgeries ---
const processSurgeriesForDisplay = (surgeries: Surgery[]): ProcessedItem[] => {
    const condensableSurgeries: Surgery[] = [];
    const otherSurgeries: ProcessedItem[] = [];

    for (const surgery of surgeries) {
        if (/endoscopia|colonoscopia/i.test(surgery.name) && surgery.startTime) {
            condensableSurgeries.push(surgery);
        } else {
            otherSurgeries.push({ ...surgery, type: 'single' });
        }
    }

    const groupedBySurgeon = condensableSurgeries.reduce((acc, surgery) => {
        if (!acc[surgery.surgeon]) {
            acc[surgery.surgeon] = [];
        }
        acc[surgery.surgeon].push(surgery);
        return acc;
    }, {} as Record<string, Surgery[]>);

    const finalProcessedItems: ProcessedItem[] = [...otherSurgeries];

    for (const surgeon in groupedBySurgeon) {
        const surgeonSurgeries = groupedBySurgeon[surgeon].sort((a, b) =>
            a.startTime!.localeCompare(b.startTime!)
        );

        if (surgeonSurgeries.length === 0) continue;

        let currentGroup: Surgery[] = [surgeonSurgeries[0]];

        for (let i = 1; i < surgeonSurgeries.length; i++) {
            const prevSurgery = currentGroup[currentGroup.length - 1];
            const currentSurgery = surgeonSurgeries[i];

            const prevTime = timeToMinutes(prevSurgery.startTime!);
            const currentTime = timeToMinutes(currentSurgery.startTime!);

            if (currentTime - prevTime < 60) {
                currentGroup.push(currentSurgery);
            } else {
                if (currentGroup.length > 1) {
                    const totalEstimatedTime = currentGroup.reduce((sum, s) => sum + s.estimatedTime, 0);
                    const procedureCounts = currentGroup.reduce((counts, s) => {
                        const name = /endoscopia/i.test(s.name) ? 'Endoscopia' : 'Colonoscopia';
                        counts[name] = (counts[name] || 0) + 1;
                        return counts;
                    }, {} as Record<string, number>);
                    
                    finalProcessedItems.push({
                        id: `condensed-${currentGroup[0].id}`,
                        type: 'condensed',
                        surgeon: currentGroup[0].surgeon,
                        surgeonId: currentGroup[0].surgeonId,
                        hospital: currentGroup[0].hospital,
                        startTime: currentGroup[0].startTime,
                        totalEstimatedTime,
                        procedureCounts,
                        anesthesiologistId: currentGroup[0].anesthesiologistId,
                        secondAnesthesiologistId: currentGroup[0].secondAnesthesiologistId,
                        surgeries: currentGroup,
                    });
                } else {
                    finalProcessedItems.push({...currentGroup[0], type: 'single'});
                }
                currentGroup = [currentSurgery];
            }
        }

        if (currentGroup.length > 1) {
            const totalEstimatedTime = currentGroup.reduce((sum, s) => sum + s.estimatedTime, 0);
            const procedureCounts = currentGroup.reduce((counts, s) => {
                const name = /endoscopia/i.test(s.name) ? 'Endoscopia' : 'Colonoscopia';
                counts[name] = (counts[name] || 0) + 1;
                return counts;
            }, {} as Record<string, number>);
            
            finalProcessedItems.push({
                id: `condensed-${currentGroup[0].id}`,
                type: 'condensed',
                surgeon: currentGroup[0].surgeon,
                surgeonId: currentGroup[0].surgeonId,
                hospital: currentGroup[0].hospital,
                startTime: currentGroup[0].startTime,
                totalEstimatedTime,
                procedureCounts,
                anesthesiologistId: currentGroup[0].anesthesiologistId,
                secondAnesthesiologistId: currentGroup[0].secondAnesthesiologistId,
                surgeries: currentGroup,
            });
        } else if (currentGroup.length === 1) {
            finalProcessedItems.push({...currentGroup[0], type: 'single'});
        }
    }

    return finalProcessedItems.sort((a, b) => {
        const timeA = 'startTime' in a ? a.startTime : undefined;
        const timeB = 'startTime' in b ? b.startTime : undefined;
        
        if (timeA && timeB) return timeA.localeCompare(timeB);
        if (timeA) return -1;
        if (timeB) return 1;

        const nameA = 'name' in a && a.name ? a.name : ('type' in a ? a.type : '');
        const nameB = 'name' in b && b.name ? b.name : ('type' in b ? b.type : '');
        return nameA.localeCompare(nameB);
    });
};


// --- CondensedSurgeryCard Component (New) ---
interface CondensedSurgeryCardProps {
    block: CondensedSurgeryBlock;
    anesthesiologistColor: string;
    anesthesiologists: Anesthesiologist[];
    onDelete: () => void;
    onEdit: (block: CondensedSurgeryBlock) => void;
    isReadOnly: boolean;
}

const CondensedSurgeryCard: React.FC<CondensedSurgeryCardProps> = ({ block, anesthesiologistColor, anesthesiologists, onDelete, onEdit, isReadOnly }) => {
    const summary = Object.entries(block.procedureCounts)
        // Fix: Explicitly cast `count` to a number to resolve a type error where it was inferred as `unknown`.
        .map(([name, count]) => `${count} ${name}${Number(count) > 1 ? 's' : ''}`)
        .join(', ');

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
    };

    const secondAnesthesiologist = block.secondAnesthesiologistId ? anesthesiologists.find(a => a.id === block.secondAnesthesiologistId) : null;

    return (
        <div
            onClick={() => !isReadOnly && onEdit(block)}
            className={`p-3 mb-2 rounded-lg shadow-sm border-l-4 ${anesthesiologistColor || 'border-gray-400'} bg-gray-50 dark:bg-gray-700 ${!isReadOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'cursor-default'}`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold text-gray-800 dark:text-white">{summary}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Dr. {block.surgeon}</p>
                    {block.hospital && <p className="text-sm text-gray-500 dark:text-gray-300">{block.hospital}</p>}
                    {secondAnesthesiologist && (
                        <p className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1 mt-1 font-medium">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                             {secondAnesthesiologist.name}
                        </p>
                    )}
                </div>
                {!isReadOnly && (
                    <button onClick={handleDeleteClick} disabled={isReadOnly} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed z-10 relative">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>
             <div className="text-xs text-right mt-1 text-gray-500 dark:text-gray-300 font-medium flex items-center justify-end">
                {block.startTime && (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                        <span>{block.startTime}</span>
                        <span className="mx-1.5">|</span>
                    </>
                )}
                <span>{formatTime(block.totalEstimatedTime)}</span>
            </div>
        </div>
    );
};


// --- SurgeryCard Component (Clickable) ---
interface SurgeryCardProps {
    surgery: Surgery;
    anesthesiologistColor: string;
    anesthesiologists: Anesthesiologist[];
    onDelete: (surgeryId: string) => void;
    onEdit: (surgery: Surgery) => void;
    isReadOnly: boolean;
}

const SurgeryCard: React.FC<SurgeryCardProps> = ({ surgery, anesthesiologistColor, anesthesiologists, onDelete, onEdit, isReadOnly }) => {

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(surgery.id);
    };

    const secondAnesthesiologist = surgery.secondAnesthesiologistId ? anesthesiologists.find(a => a.id === surgery.secondAnesthesiologistId) : null;

    return (
        <div
            onClick={() => !isReadOnly && onEdit(surgery)}
            className={`p-3 mb-2 rounded-lg shadow-sm border-l-4 ${anesthesiologistColor || 'border-gray-400'} bg-gray-50 dark:bg-gray-700 ${!isReadOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'cursor-default'}`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold text-gray-800 dark:text-white">{surgery.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Dr. {surgery.surgeon}</p>
                    {surgery.hospital && <p className="text-sm text-gray-500 dark:text-gray-300">{surgery.hospital}</p>}
                     {secondAnesthesiologist && (
                        <p className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1 mt-1 font-medium">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                             {secondAnesthesiologist.name}
                        </p>
                    )}
                </div>
                {!isReadOnly && (
                    <button onClick={handleDeleteClick} disabled={isReadOnly} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed z-10 relative">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
            </div>
             <div className="text-xs text-right mt-1 text-gray-500 dark:text-gray-300 font-medium flex items-center justify-end">
                {surgery.startTime && (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                        <span>{surgery.startTime}</span>
                        <span className="mx-1.5">|</span>
                    </>
                )}
                <span>{formatTime(surgery.estimatedTime)}</span>
            </div>
        </div>
    );
};


// --- AnesthesiologistColumn Component ---
interface AnesthesiologistColumnProps {
    anesthesiologist: Anesthesiologist | null; // null for 'Unassigned'
    surgeries: Surgery[];
    dailySurgeries: Surgery[];
    allSurgeries: Surgery[];
    anesthesiologists: Anesthesiologist[];
    onDelete: (surgeryId: string) => void;
    onEdit: (surgery: Surgery) => void;
    onBlockEdit: (block: CondensedSurgeryBlock) => void;
    onBlockDelete: (surgeries: Surgery[]) => void;
    isReadOnly: boolean;
}

const AnesthesiologistColumn: React.FC<AnesthesiologistColumnProps> = ({ anesthesiologist, surgeries, dailySurgeries, allSurgeries, anesthesiologists, onEdit, onDelete, onBlockEdit, onBlockDelete, isReadOnly }) => {
    
    const calculateWorkload = (id: string | null): number => {
        if (!id) return 0;
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - WORKLOAD_DAYS);
        const primaryWorkload = allSurgeries
            .filter(s => s.anesthesiologistId === id && s.date >= sevenDaysAgo && s.date < today)
            .reduce((total, s) => total + s.estimatedTime, 0);
        const secondaryWorkload = allSurgeries
            .filter(s => s.secondAnesthesiologistId === id && s.date >= sevenDaysAgo && s.date < today)
            .reduce((total, s) => total + s.estimatedTime, 0);
        return primaryWorkload + secondaryWorkload;
    };

    const pastWorkload = calculateWorkload(anesthesiologist?.id || null);

    const dailyWorkload = useMemo(() => {
        const primaryDaily = surgeries.reduce((total, s) => total + s.estimatedTime, 0);
        const secondaryDaily = dailySurgeries
            .filter(s => s.secondAnesthesiologistId === anesthesiologist?.id)
            .reduce((total, s) => total + s.estimatedTime, 0);
        return primaryDaily + secondaryDaily;
    }, [surgeries, dailySurgeries, anesthesiologist]);

    const workloadPercentage = Math.min((dailyWorkload / 480) * 100, 100); // Assume 8-hour day

    const processedItems = useMemo(() => {
        return processSurgeriesForDisplay(surgeries);
    }, [surgeries]);

    return (
        <div
            className="rounded-xl p-4 h-full bg-gray-100 dark:bg-gray-900/50"
        >
            <div className={`p-3 rounded-t-lg ${anesthesiologist?.color || 'bg-gray-400 dark:bg-gray-600'}`}>
                <h3 className="font-bold text-gray-800 dark:text-white text-center">{anesthesiologist?.name || 'Não Atribuído'}</h3>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-b-lg shadow-inner min-h-[200px]">
                {processedItems.map(item => {
                    const anesthesiologistColor = anesthesiologists.find(a => a.id === item.anesthesiologistId)?.color?.replace('bg-', 'border-') || 'border-gray-400';

                    if (item.type === 'condensed') {
                        return <CondensedSurgeryCard 
                            key={item.id} 
                            block={item as CondensedSurgeryBlock} 
                            anesthesiologistColor={anesthesiologistColor} 
                            anesthesiologists={anesthesiologists}
                            onDelete={() => onBlockDelete((item as CondensedSurgeryBlock).surgeries)}
                            onEdit={onBlockEdit}
                            isReadOnly={isReadOnly}
                        />
                    } else {
                         const surgery = item as Surgery;
                         return (
                            <SurgeryCard 
                                key={surgery.id} 
                                surgery={surgery} 
                                anesthesiologistColor={anesthesiologistColor}
                                anesthesiologists={anesthesiologists}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                isReadOnly={isReadOnly}
                            />
                        );
                    }
                })}
                {processedItems.length === 0 && <p className="text-sm text-center text-gray-400 pt-8">Nenhuma cirurgia</p>}
            </div>
             <div className="mt-4 px-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Carga Diária: {formatTime(dailyWorkload)}</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-1">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${workloadPercentage}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Últimos {WORKLOAD_DAYS} dias: {formatTime(pastWorkload)}</p>
            </div>
        </div>
    );
};

// --- ScheduleView Component (Main) ---
interface ScheduleViewProps {
    dailySurgeries: Surgery[];
    allSurgeries: Surgery[];
    anesthesiologists: Anesthesiologist[];
    updateSurgery: (surgery: Surgery) => void;
    deleteSurgery: (surgeryId: string) => void;
    selectedDate: Date;
    weekendOnCallSchedule: { [date: string]: OnCallAssignment[] };
    vacationSchedule: VacationSchedule;
    isReadOnly: boolean;
    surgeons: Surgeon[];
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ dailySurgeries, allSurgeries, anesthesiologists, updateSurgery, deleteSurgery, selectedDate, weekendOnCallSchedule, vacationSchedule, isReadOnly, surgeons }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [editingSurgery, setEditingSurgery] = useState<Surgery | null>(null);
    const [editingBlock, setEditingBlock] = useState<CondensedSurgeryBlock | null>(null);
    const [isConfirmClearModalOpen, setIsConfirmClearModalOpen] = useState(false);
    const [surgeryIdToDelete, setSurgeryIdToDelete] = useState<string | null>(null);
    const [surgeryBlockToDelete, setSurgeryBlockToDelete] = useState<Surgery[] | null>(null);

    const displayedAnesthesiologists = useMemo(() => {
        return anesthesiologists.filter(a => {
            const getStatus = (period: TimePeriod): AvailabilityStatus => {
                const date = selectedDate;
                const dateString = date.toISOString().split('T')[0];
                const dayOfWeek = date.getDay();

                // Vacation check (highest priority, Mon-Fri only)
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    const dateCopy = new Date(date.getTime());
                    // Go back to Monday of the current week
                    dateCopy.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                    const weekStartDateStr = dateCopy.toISOString().split('T')[0];
            
                    if (vacationSchedule[weekStartDateStr]?.includes(a.id)) {
                        return AvailabilityStatus.Vacation;
                    }
                }

                const specificStatus = a.availability[dateString]?.[period];
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

                if (weekendStartDateStr && weekendOnCallSchedule.hasOwnProperty(weekendStartDateStr)) {
                    const isWithinOnCallPeriod = (
                        (dayOfWeek === 5 && period === TimePeriod.Night) ||
                        dayOfWeek === 6 ||
                        dayOfWeek === 0
                    );
                    if (isWithinOnCallPeriod) {
                        const isOnCall = weekendOnCallSchedule[weekendStartDateStr].some(assignment => assignment.id === a.id);
                        return isOnCall ? AvailabilityStatus.Available : AvailabilityStatus.DayOff;
                    }
                }

                const defaultStatus = a.defaultAvailability?.[dayOfWeek]?.[period];
                if (defaultStatus) return defaultStatus;

                return AvailabilityStatus.Available;
            };

            const isUnavailableAllDay =
                getStatus(TimePeriod.Morning) !== AvailabilityStatus.Available &&
                getStatus(TimePeriod.Afternoon) !== AvailabilityStatus.Available &&
                getStatus(TimePeriod.Night) !== AvailabilityStatus.Available;
            
            const hasSurgeriesToday = dailySurgeries.some(s => s.anesthesiologistId === a.id || s.secondAnesthesiologistId === a.id);

            return !isUnavailableAllDay || hasSurgeriesToday;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [anesthesiologists, selectedDate, dailySurgeries, weekendOnCallSchedule, vacationSchedule]);
    
    const handleSaveSurgery = async (updatedSurgery: Surgery) => {
        await updateSurgery(updatedSurgery);
        setEditingSurgery(null);
    };

    const handleSaveBlock = async (blockId: string, updates: { totalEstimatedTime: number; anesthesiologistId: string | null; secondAnesthesiologistId?: string | null; }) => {
        if (!editingBlock || editingBlock.id !== blockId) return;

        const originalSurgeries = editingBlock.surgeries;
        if (!originalSurgeries || originalSurgeries.length === 0) return;

        const newTimePerSurgery = Math.round(updates.totalEstimatedTime / originalSurgeries.length);

        const updatePromises = originalSurgeries.map(surgery => {
            const updatedSurgery = {
                ...surgery,
                anesthesiologistId: updates.anesthesiologistId,
                secondAnesthesiologistId: updates.secondAnesthesiologistId,
                estimatedTime: newTimePerSurgery
            };
            return updateSurgery(updatedSurgery);
        });

        await Promise.all(updatePromises);
        setEditingBlock(null);
    };

    const handleClearAssignments = () => {
        const assignedSurgeries = dailySurgeries.filter(s => s.anesthesiologistId);
        if (assignedSurgeries.length > 0) {
            setIsConfirmClearModalOpen(true);
        }
    };
    
    const executeClearAssignments = async () => {
        const assignedSurgeries = dailySurgeries.filter(s => s.anesthesiologistId);
        try {
            const updatePromises = assignedSurgeries.map(surgery => 
                updateSurgery({ ...surgery, anesthesiologistId: null })
            );
            await Promise.all(updatePromises);
        } catch (error) {
            console.error("Failed to clear assignments:", error);
            alert("Ocorreu um erro ao limpar as atribuições. Por favor, tente novamente.");
        } finally {
            setIsConfirmClearModalOpen(false);
        }
    };
    
    const handleDeleteRequest = (id: string) => {
        setSurgeryIdToDelete(id);
    };

    const handleConfirmDelete = () => {
        if (surgeryIdToDelete) {
            deleteSurgery(surgeryIdToDelete);
            setSurgeryIdToDelete(null);
        }
    };

    const handleBlockDeleteRequest = (surgeries: Surgery[]) => {
        setSurgeryBlockToDelete(surgeries);
    };

    const handleConfirmBlockDelete = async () => {
        if (surgeryBlockToDelete) {
            await Promise.all(surgeryBlockToDelete.map(s => deleteSurgery(s.id)));
            setSurgeryBlockToDelete(null);
        }
    };

    const unassignedSurgeries = dailySurgeries.filter(s => !s.anesthesiologistId);
    const hasAssignedSurgeries = dailySurgeries.some(s => s.anesthesiologistId);

    const handleCopySchedule = () => {
        const dateString = selectedDate.toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    
        let scheduleText = `Escala para ${dateString}\n------------------------------------\n\n`;
    
        const anesthesiologistMap = new Map(anesthesiologists.map(a => [a.id, a.name]));
        const processedItems = processSurgeriesForDisplay(dailySurgeries);
    
        const surgeriesByHospital = processedItems.reduce((acc, item) => {
            const hospital = item.hospital || 'Hospital não especificado';
            if (!acc[hospital]) {
                acc[hospital] = [];
            }
            acc[hospital].push(item);
            return acc;
        }, {} as Record<string, ProcessedItem[]>);
    
        const sortedHospitals = Object.keys(surgeriesByHospital).sort();
    
        for (const hospital of sortedHospitals) {
            scheduleText += `**${hospital}**\n`;
    
            const hospitalItems = surgeriesByHospital[hospital];
            hospitalItems.sort((a, b) => {
                const timeA = a.startTime || '99:99'; // Sort items without time to the end
                const timeB = b.startTime || '99:99';
                return timeA.localeCompare(timeB);
            });
    
            hospitalItems.forEach(item => {
                let formattedAnesthesiologistName: string;
                if (item.anesthesiologistId) {
                    const anesthesiologistName = anesthesiologistMap.get(item.anesthesiologistId);
                    // Fix: Explicitly cast the value to a string before calling `toUpperCase` to prevent potential type errors
                    // where the value might be inferred as `unknown`.
                    formattedAnesthesiologistName = anesthesiologistName ? `*${String(anesthesiologistName).toUpperCase()}*` : '*NÃO ATRIBUÍDO*';
                } else {
                    formattedAnesthesiologistName = '*NÃO ATRIBUÍDO*';
                }

                if (item.secondAnesthesiologistId) {
                    const secondName = anesthesiologistMap.get(item.secondAnesthesiologistId);
                    if(secondName) {
                       formattedAnesthesiologistName += ` + *${String(secondName).toUpperCase()}*`;
                    }
                }
                
                const startTimePrefix = item.startTime ? `${item.startTime} - ` : '';
                const surgeonName = `Dr. ${item.surgeon}`;
    
                scheduleText += `- ${startTimePrefix}${surgeonName} - ${formattedAnesthesiologistName}\n`;
            });
    
            scheduleText += '\n';
        }
    
        navigator.clipboard.writeText(scheduleText.trim()).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Falha ao copiar a escala: ', err);
        });
    };
    

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Escala para {selectedDate.toLocaleDateString()}</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleClearAssignments}
                        disabled={!hasAssignedSurgeries}
                        className="flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-500 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/80 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remover todas as atribuições"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Limpar Atribuições
                    </button>
                    <button
                        onClick={handleCopySchedule}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 ${
                            isCopied
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        {isCopied ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Copiado!
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copiar Lista
                            </>
                        )}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 <AnesthesiologistColumn
                    anesthesiologist={null}
                    surgeries={unassignedSurgeries}
                    dailySurgeries={dailySurgeries}
                    allSurgeries={allSurgeries}
                    anesthesiologists={anesthesiologists}
                    onEdit={(surgery) => setEditingSurgery(surgery)}
                    onDelete={handleDeleteRequest}
                    onBlockEdit={(block) => setEditingBlock(block)}
                    onBlockDelete={handleBlockDeleteRequest}
                    isReadOnly={isReadOnly}
                />
                {displayedAnesthesiologists.map(a => (
                    <AnesthesiologistColumn
                        key={a.id}
                        anesthesiologist={a}
                        surgeries={dailySurgeries.filter(s => s.anesthesiologistId === a.id)}
                        dailySurgeries={dailySurgeries}
                        allSurgeries={allSurgeries}
                        anesthesiologists={anesthesiologists}
                        onEdit={(surgery) => setEditingSurgery(surgery)}
                        onDelete={handleDeleteRequest}
                        onBlockEdit={(block) => setEditingBlock(block)}
                        onBlockDelete={handleBlockDeleteRequest}
                        isReadOnly={isReadOnly}
                    />
                ))}
            </div>
            {editingSurgery && (
                <EditSurgeryModal
                    isOpen={!!editingSurgery}
                    onClose={() => setEditingSurgery(null)}
                    onSave={handleSaveSurgery}
                    surgery={editingSurgery}
                    anesthesiologists={anesthesiologists}
                    dailySurgeries={dailySurgeries}
                    weekendOnCallSchedule={weekendOnCallSchedule}
                    vacationSchedule={vacationSchedule}
                    selectedDate={selectedDate}
                    surgeons={surgeons}
                />
            )}
            {editingBlock && (
                 <EditBlockModal
                    isOpen={!!editingBlock}
                    onClose={() => setEditingBlock(null)}
                    onSave={handleSaveBlock}
                    block={editingBlock}
                    anesthesiologists={anesthesiologists}
                    dailySurgeries={dailySurgeries}
                    weekendOnCallSchedule={weekendOnCallSchedule}
                    vacationSchedule={vacationSchedule}
                    selectedDate={selectedDate}
                    surgeons={surgeons}
                />
            )}
            {isConfirmClearModalOpen && (
                <ConfirmationModal
                    isOpen={isConfirmClearModalOpen}
                    onClose={() => setIsConfirmClearModalOpen(false)}
                    onConfirm={executeClearAssignments}
                    title="Confirmar Limpeza da Escala"
                    message={`Tem certeza que deseja remover todas as ${dailySurgeries.filter(s => s.anesthesiologistId).length} atribuições? Todas as cirurgias agendadas serão marcadas como 'Não Atribuído'.`}
                />
            )}
            {surgeryIdToDelete && (
                <ConfirmationModal
                    isOpen={!!surgeryIdToDelete}
                    onClose={() => setSurgeryIdToDelete(null)}
                    onConfirm={handleConfirmDelete}
                    title="Confirmar Exclusão de Cirurgia"
                    message={`Tem certeza que deseja excluir a cirurgia "${dailySurgeries.find(s => s.id === surgeryIdToDelete)?.name || ''}"? Esta ação não pode ser desfeita.`}
                />
            )}
            {surgeryBlockToDelete && (
                <ConfirmationModal
                    isOpen={!!surgeryBlockToDelete}
                    onClose={() => setSurgeryBlockToDelete(null)}
                    onConfirm={handleConfirmBlockDelete}
                    title="Confirmar Exclusão de Bloco"
                    message={`Tem certeza que deseja excluir este bloco com ${surgeryBlockToDelete.length} exames? Esta ação não pode ser desfeita.`}
                />
            )}
        </div>
    );
};

export default ScheduleView;