import React, { useState, useMemo, useRef } from 'react';
import { Anesthesiologist, TimePeriod, AvailabilityStatus, OnCallAssignment, Surgery, VacationSchedule, Surgeon } from '../types';
import { ExtractedSurgeryData, extractSurgeriesFromImage, extractSurgeriesFromPdf } from '../services/geminiService';
import SelectHospitalModal from './SelectHospitalModal';
import SurgeryReviewModal from './SurgeryReviewModal';

interface SurgerySchedulerProps {
    addSurgery: (surgery: Omit<Surgery, 'id'>) => void;
    availableAnesthesiologists: Anesthesiologist[];
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    dailySurgeries: Surgery[];
    onSuggestSchedule: () => void;
    hasUnassignedSurgeries: boolean;
    isSuggesting: boolean;
    isReadOnly: boolean;
    weekendOnCallSchedule: { [date: string]: OnCallAssignment[] };
    vacationSchedule: VacationSchedule;
    surgeons: Surgeon[];
}

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
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};


const SurgeryScheduler: React.FC<SurgerySchedulerProps> = ({ 
    addSurgery, 
    availableAnesthesiologists, 
    selectedDate, 
    setSelectedDate, 
    dailySurgeries, 
    onSuggestSchedule, 
    hasUnassignedSurgeries, 
    isSuggesting, 
    isReadOnly, 
    weekendOnCallSchedule,
    vacationSchedule,
    surgeons
}) => {
    const [name, setName] = useState('');
    const [surgeonId, setSurgeonId] = useState('');
    const [surgeonName, setSurgeonName] = useState('');
    const [hospital, setHospital] = useState('');
    const [hours, setHours] = useState('');
    const [minutes, setMinutes] = useState('');
    const [startTime, setStartTime] = useState('');
    const [anesthesiologistId, setAnesthesiologistId] = useState<string | null>(null);
    const [secondAnesthesiologistId, setSecondAnesthesiologistId] = useState<string | null>(null);
    const [forceAllocation, setForceAllocation] = useState(false);
    const [showBlocked, setShowBlocked] = useState(false);
    const [addSecondAnesthesiologist, setAddSecondAnesthesiologist] = useState(false);

    // State for image import flow
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [extractedSurgeries, setExtractedSurgeries] = useState<ExtractedSurgeryData[]>([]);
    const [hospitalForImport, setHospitalForImport] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    const periodAvailableAnesthesiologists = useMemo(() => {
        const requiredPeriod = getPeriodForTime(startTime);
        if (!requiredPeriod) {
            return availableAnesthesiologists;
        }
        return availableAnesthesiologists.filter(a => {
            const status = getAvailabilityStatus(a, requiredPeriod, selectedDate, weekendOnCallSchedule, vacationSchedule);
            return status === AvailabilityStatus.Available;
        });
    }, [startTime, availableAnesthesiologists, selectedDate, weekendOnCallSchedule, vacationSchedule]);
    
    const getConflictInfo = (anesthesiologist: Anesthesiologist, estimatedTime: number, startTime: string) => {
        let hasConflict = false;
        if (estimatedTime > 0 && startTime) {
            const newSurgeryStartMinutes = timeToMinutes(startTime);
            const newSurgeryEndMinutes = newSurgeryStartMinutes + estimatedTime;
            const assignedSurgeries = dailySurgeries.filter(s => s.anesthesiologistId === anesthesiologist.id || s.secondAnesthesiologistId === anesthesiologist.id);
            hasConflict = assignedSurgeries.some(existingSurgery => {
                if (!existingSurgery.startTime) return false;
                const existingStartMinutes = timeToMinutes(existingSurgery.startTime);
                const existingEndMinutes = existingStartMinutes + existingSurgery.estimatedTime;
                return newSurgeryStartMinutes < existingEndMinutes && newSurgeryEndMinutes > existingStartMinutes;
            });
        }
        return { hasConflict, conflictText: hasConflict ? ' (Conflito!)' : '' };
    };

    const filteredAnesthesiologistsForDropdown = useMemo(() => {
        if (!startTime) {
             return periodAvailableAnesthesiologists.map(a => ({ ...a, conflictText: '' }));
        }
    
        const estimatedTime = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
        
        const selectedSurgeon = surgeons.find(s => s.id === surgeonId);
        const blockedIds = selectedSurgeon?.blockedAnesthesiologistIds || [];

        const anesthesiologistsWithInfo = periodAvailableAnesthesiologists.map(a => {
            const { hasConflict, conflictText } = getConflictInfo(a, estimatedTime, startTime);
            const isBlocked = blockedIds.includes(a.id);
            return { ...a, hasConflict, conflictText, isBlocked };
        });
    
        let filtered = anesthesiologistsWithInfo;

        if (!forceAllocation) {
            filtered = filtered.filter(a => !a.hasConflict);
        }

        if (!showBlocked) {
            filtered = filtered.filter(a => !a.isBlocked);
        }
    
        if (anesthesiologistId && !filtered.some(a => a.id === anesthesiologistId)) {
            setAnesthesiologistId(null);
        }
    
        return filtered;
    }, [startTime, hours, minutes, periodAvailableAnesthesiologists, dailySurgeries, anesthesiologistId, forceAllocation, showBlocked, surgeonId, surgeons, getConflictInfo]);
    
    const filteredSecondAnesthesiologistsForDropdown = useMemo(() => {
        if (!addSecondAnesthesiologist || !startTime) {
            return [];
        }
        
        const estimatedTime = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
        
        const selectedSurgeon = surgeons.find(s => s.id === surgeonId);
        const blockedIds = selectedSurgeon?.blockedAnesthesiologistIds || [];

        return periodAvailableAnesthesiologists
            .filter(a => a.id !== anesthesiologistId) // Exclude the primary anesthesiologist
            .map(a => {
                const { hasConflict, conflictText } = getConflictInfo(a, estimatedTime, startTime);
                const isBlocked = blockedIds.includes(a.id);
                return { ...a, hasConflict, conflictText, isBlocked };
            })
            .filter(a => showBlocked || !a.isBlocked);
            
    }, [addSecondAnesthesiologist, startTime, hours, minutes, periodAvailableAnesthesiologists, dailySurgeries, anesthesiologistId, showBlocked, surgeonId, surgeons, getConflictInfo]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const estimatedTime = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
        const finalSurgeonName = surgeonId ? (surgeons.find(s => s.id === surgeonId)?.name || surgeonName) : surgeonName;
        
        if (name && finalSurgeonName && hospital && estimatedTime > 0 && startTime) {
            addSurgery({ 
                name, 
                surgeon: finalSurgeonName,
                surgeonId: surgeonId || undefined,
                hospital, 
                estimatedTime, 
                date: selectedDate, 
                anesthesiologistId, 
                secondAnesthesiologistId: addSecondAnesthesiologist ? secondAnesthesiologistId : null,
                startTime 
            });
            setName('');
            setSurgeonId('');
            setSurgeonName('');
            setHospital('');
            setHours('');
            setMinutes('');
            setStartTime('');
            setAnesthesiologistId(null);
            setSecondAnesthesiologistId(null);
            setForceAllocation(false);
            setShowBlocked(false);
            setAddSecondAnesthesiologist(false);
        }
    };

    const handleCloseAndResetImport = () => {
        setIsHospitalModalOpen(false);
        setIsReviewModalOpen(false);
        setExtractedSurgeries([]);
        setHospitalForImport('');
        setImportError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (pdfInputRef.current) {
            pdfInputRef.current.value = '';
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportError('');

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64Image = (reader.result as string).split(',')[1];
                    const surgeries = await extractSurgeriesFromImage(base64Image, file.type);
                    setExtractedSurgeries(surgeries);
                    setIsHospitalModalOpen(true);
                } catch (error) {
                     setImportError((error as Error).message);
                } finally {
                     setIsImporting(false);
                }
            };
            reader.onerror = () => {
                setImportError('Falha ao ler o arquivo de imagem.');
                setIsImporting(false);
            };
        } catch (error) {
            setImportError('Ocorreu um erro inesperado.');
            setIsImporting(false);
        }
    };

    const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportError('');

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64Pdf = (reader.result as string).split(',')[1];
                    const surgeries = await extractSurgeriesFromPdf(base64Pdf, file.type);
                    setExtractedSurgeries(surgeries);
                    setIsHospitalModalOpen(true);
                } catch (error) {
                     setImportError((error as Error).message);
                } finally {
                     setIsImporting(false);
                }
            };
            reader.onerror = () => {
                setImportError('Falha ao ler o arquivo PDF.');
                setIsImporting(false);
            };
        } catch (error) {
            setImportError('Ocorreu um erro inesperado.');
            setIsImporting(false);
        }
    };


    const handleHospitalConfirm = (hospitalName: string) => {
        setHospitalForImport(hospitalName);
        setIsHospitalModalOpen(false);
        if (extractedSurgeries.length > 0) {
            setIsReviewModalOpen(true);
        } else {
            alert("Nenhuma cirurgia compatível foi encontrada no documento.");
            handleCloseAndResetImport();
        }
    };

    const handleReviewConfirm = (surgeriesToImport: ExtractedSurgeryData[]) => {
        surgeriesToImport.forEach(surgery => {
            addSurgery({
                name: surgery.name,
                surgeon: surgery.surgeon,
                hospital: hospitalForImport,
                estimatedTime: 60, // Default duration
                date: selectedDate,
                anesthesiologistId: null,
                secondAnesthesiologistId: null,
                startTime: surgery.startTime,
            });
        });
        handleCloseAndResetImport();
    };


    return (
        <>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-full">
                <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-bold text-gray-800 dark:text-white">Adicionar Cirurgia para {selectedDate.toLocaleDateString()}</h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <fieldset disabled={isReadOnly} className="space-y-4">
                        <div>
                            <label htmlFor="surgeryName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Nome da Cirurgia</label>
                            <input type="text" id="surgeryName" value={name} onChange={(e) => setName(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" required />
                        </div>
                        <div>
                            <label htmlFor="surgeon" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Cirurgião</label>
                            <div className="flex gap-2">
                                <select 
                                    id="surgeonSelect" 
                                    value={surgeonId} 
                                    onChange={(e) => {
                                        setSurgeonId(e.target.value);
                                        if (e.target.value) setSurgeonName('');
                                    }} 
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Selecionar Cirurgião Cadastrado</option>
                                    {surgeons.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                    <option value="other">Outro (Digitar nome)</option>
                                </select>
                            </div>
                            {(surgeonId === 'other' || surgeonId === '') && (
                                <input 
                                    type="text" 
                                    value={surgeonName} 
                                    onChange={(e) => setSurgeonName(e.target.value)} 
                                    placeholder="Nome do Cirurgião"
                                    className="mt-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                                    required={!surgeonId}
                                />
                            )}
                        </div>
                        <div>
                            <label htmlFor="hospital" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Hospital</label>
                            <input type="text" id="hospital" value={hospital} onChange={(e) => setHospital(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="startTime" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Horário de Início</label>
                                <input type="time" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" required />
                            </div>
                             <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Tempo Estimado</label>
                                <div className="flex items-center space-x-2">
                                    <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="H" min="0" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" />
                                    <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="M" min="0" max="59" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 flex-1 min-w-[150px]">
                                    <input 
                                        id="forceAllocation" 
                                        type="checkbox" 
                                        checked={forceAllocation} 
                                        onChange={(e) => setForceAllocation(e.target.checked)}
                                        className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800"
                                    />
                                    <label htmlFor="forceAllocation" className="ml-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                        Sala simultânea
                                    </label>
                                </div>
                                <div className="flex items-center p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 flex-1 min-w-[150px]">
                                    <input 
                                        id="showBlocked" 
                                        type="checkbox" 
                                        checked={showBlocked} 
                                        onChange={(e) => setShowBlocked(e.target.checked)}
                                        className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800"
                                    />
                                    <label htmlFor="showBlocked" className="ml-2 text-sm font-medium text-red-800 dark:text-red-200">
                                        Forçar bloqueados
                                    </label>
                                </div>
                            </div>
                             <div className="flex items-center p-2 rounded-md bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800/50">
                                <input 
                                    id="addSecondAnesthesiologist" 
                                    type="checkbox" 
                                    checked={addSecondAnesthesiologist} 
                                    onChange={(e) => setAddSecondAnesthesiologist(e.target.checked)}
                                    className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-gray-800"
                                />
                                <label htmlFor="addSecondAnesthesiologist" className="ml-2 text-sm font-medium text-sky-800 dark:text-sky-200">
                                    Adicionar segundo anestesista (caso complexo)
                                </label>
                            </div>
                            <div>
                                <label htmlFor="anesthesiologist" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Anestesista Principal (Opcional)</label>
                                <select id="anesthesiologist" value={anesthesiologistId || ''} onChange={(e) => setAnesthesiologistId(e.target.value || null)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                                    <option value="">Não Atribuído</option>
                                    {filteredAnesthesiologistsForDropdown.map(a => (
                                        <option key={a.id} value={a.id} className={`${a.hasConflict ? 'text-red-600 dark:text-red-400 font-bold' : ''} ${a.isBlocked ? 'italic text-orange-600 dark:text-orange-400' : ''}`}>
                                            {a.name}{a.conflictText}{a.isBlocked ? ' (Bloqueado)' : ''}
                                        </option>
                                    ))}
                                </select>
                                {!startTime && <p className="text-xs text-blue-500 mt-1">Insira um horário de início para ver a lista de anestesistas.</p>}
                            </div>

                            {addSecondAnesthesiologist && (
                                <div>
                                    <label htmlFor="secondAnesthesiologist" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Segundo Anestesista (Opcional)</label>
                                    <select id="secondAnesthesiologist" value={secondAnesthesiologistId || ''} onChange={(e) => setSecondAnesthesiologistId(e.target.value || null)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                                        <option value="">Nenhum</option>
                                        {filteredSecondAnesthesiologistsForDropdown.map(a => (
                                            <option key={a.id} value={a.id} className={a.hasConflict ? 'text-red-600 dark:text-red-400 font-bold' : ''}>{a.name}{a.conflictText}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <button type="submit" className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed">
                            Adicionar Cirurgia
                        </button>
                    </fieldset>
                </form>
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Assistentes de Escala com IA</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Poupe tempo usando a IA para sugerir escalas ou importar cirurgias de uma imagem ou PDF.</p>
                     <button 
                        onClick={onSuggestSchedule} 
                        disabled={!hasUnassignedSurgeries || isSuggesting || isReadOnly}
                        className="w-full text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-green-500 dark:hover:bg-green-600 dark:focus:ring-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSuggesting ? (
                             <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        )}
                        {isSuggesting ? 'Sugerindo...' : 'Sugerir Escala'}
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting || isReadOnly}
                            className="w-full text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isImporting ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                            )}
                            {isImporting ? 'Processando...' : 'Importar de Imagem'}
                        </button>
                         <button
                            type="button"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={isImporting || isReadOnly}
                            className="w-full text-white bg-rose-600 hover:bg-rose-700 focus:ring-4 focus:outline-none focus:ring-rose-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-rose-500 dark:hover:bg-rose-600 dark:focus:ring-rose-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isImporting ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                            )}
                            {isImporting ? 'Processando...' : 'Importar de PDF'}
                        </button>
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                        accept="image/png, image/jpeg, image/webp"
                    />
                     <input
                        type="file"
                        ref={pdfInputRef}
                        onChange={handlePdfUpload}
                        className="hidden"
                        accept="application/pdf"
                    />
                    {importError && <p className="text-red-500 text-sm mt-2">{importError}</p>}
                </div>
            </div>

            <SelectHospitalModal
                isOpen={isHospitalModalOpen}
                onClose={handleCloseAndResetImport}
                onConfirm={handleHospitalConfirm}
            />
            <SurgeryReviewModal
                isOpen={isReviewModalOpen}
                onClose={handleCloseAndResetImport}
                onConfirm={handleReviewConfirm}
                surgeries={extractedSurgeries}
            />
        </>
    );
};

export default SurgeryScheduler;