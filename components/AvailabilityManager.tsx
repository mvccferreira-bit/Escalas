import React, { useState, Fragment, useEffect, useMemo, useCallback } from 'react';
import { Anesthesiologist, AvailabilityStatus, TimePeriod, ExtraPeriod, AppUser, OnCallAssignment, OnCallRole, VacationSchedule } from '../types';
import OnCallCalendarModal from './OnCallCalendarModal';
import VacationCalendarModal from './VacationCalendarModal';
import AddExtraPeriodModal from './AddExtraPeriodModal';
import WorkloadReportModal from './WorkloadReportModal';
import EditAnesthesiologistModal from './EditAnesthesiologistModal';
import { User } from 'firebase/auth';


interface AvailabilityManagerProps {
    anesthesiologists: Anesthesiologist[];
    user: User;
    updateAvailability: (id: string, date: Date, period: TimePeriod, status: AvailabilityStatus) => void;
    updateDefaultAvailability: (id: string, dayOfWeek: number, period: TimePeriod, status: AvailabilityStatus) => void;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    addAnesthesiologist: (email: string) => Promise<void>;
    updateAnesthesiologist: (id: string, updates: { name: string; emailToLink: string | null }) => Promise<void>;
    deleteAnesthesiologist: (id: string) => void;
    weekendOnCallSchedule: { [date: string]: OnCallAssignment[] };
    updateWeekendOnCall: (weekendStartDate: string, anesthesiologistId: string, role: OnCallRole | null) => void;
    vacationSchedule: VacationSchedule;
    updateVacationSchedule: (weekStartDate: string, anesthesiologistId: string, isOnVacation: boolean) => void;
    extraPeriods: ExtraPeriod[];
    addExtraPeriod: (anesthesiologistId: string, date: Date, period: TimePeriod) => Promise<void>;
    deleteExtraPeriod: (periodId: string) => Promise<void>;
    isReadOnly: boolean;
    isAdmin: boolean;
    allUsers: AppUser[];
}

enum AvailabilitySource {
    Manual = 'Manual',
    OnCall = 'OnCall',
    Default = 'Default',
    System = 'System',
    Vacation = 'Vacation'
}

const DefaultAvailabilityModal: React.FC<{
    anesthesiologist: Anesthesiologist | null;
    onClose: () => void;
    onSave: (id: string, dayOfWeek: number, period: TimePeriod, status: AvailabilityStatus) => void;
    isReadOnly: boolean;
}> = ({ anesthesiologist, onClose, onSave, isReadOnly }) => {
    if (!anesthesiologist) return null;

    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const periods = Object.values(TimePeriod) as TimePeriod[];
    const statuses = Object.values(AvailabilityStatus);

    const getStatusColorClass = (status: AvailabilityStatus) => {
        switch (status) {
            case AvailabilityStatus.DayOff: return 'bg-yellow-400';
            case AvailabilityStatus.Vacation: return 'bg-pink-400';
            case AvailabilityStatus.Leave: return 'bg-red-400';
            default: return 'bg-green-400';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Disponibilidade Padrão de {anesthesiologist.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Ajustes manuais aqui podem ser sobrepostos pela configuração do <strong className="font-semibold">Calendário Anual de Plantões</strong> para os fins de semana.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                         <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-2">Dia</th>
                                {periods.map(p => <th key={p} className="px-4 py-2 text-center">{p}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {daysOfWeek.map((dayName, dayIndex) => (
                                <tr key={dayIndex} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{dayName}</td>
                                    {periods.map(period => {
                                        const currentStatus = anesthesiologist.defaultAvailability?.[dayIndex]?.[period] || AvailabilityStatus.Available;
                                        return (
                                            <td key={period} className="px-2 py-2">
                                                <div className="flex items-center space-x-2">
                                                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getStatusColorClass(currentStatus)}`} title={currentStatus}></span>
                                                    <select
                                                        value={currentStatus}
                                                        onChange={(e) => onSave(anesthesiologist.id, dayIndex, period, e.target.value as AvailabilityStatus)}
                                                        disabled={isReadOnly}
                                                        className="w-full p-1 border rounded text-xs bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {statuses.map(s => <option key={s} value={s} className="bg-white dark:bg-gray-700 text-black dark:text-white">{s}</option>)}
                                                    </select>
                                                </div>
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 text-right">
                    <button onClick={onClose} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};


const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({ 
    anesthesiologists,
    user,
    updateAvailability, 
    updateDefaultAvailability,
    selectedDate, 
    setSelectedDate,
    addAnesthesiologist,
    updateAnesthesiologist,
    deleteAnesthesiologist,
    weekendOnCallSchedule,
    updateWeekendOnCall,
    vacationSchedule,
    updateVacationSchedule,
    extraPeriods,
    addExtraPeriod,
    deleteExtraPeriod,
    isReadOnly,
    isAdmin,
    allUsers
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [addError, setAddError] = useState('');
    const [editingAnesthesiologist, setEditingAnesthesiologist] = useState<Anesthesiologist | null>(null);
    const [editingDefault, setEditingDefault] = useState<Anesthesiologist | null>(null);
    const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
    const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [extraPeriodModalState, setExtraPeriodModalState] = useState<{ isOpen: boolean, anesthesiologist: Anesthesiologist | null }>({ isOpen: false, anesthesiologist: null });

    const isToday = useMemo(() => selectedDate.toDateString() === new Date().toDateString(), [selectedDate]);

    useEffect(() => {
        if (editingDefault) {
            const updatedAnesthesiologist = anesthesiologists.find(a => a.id === editingDefault.id);
            if (updatedAnesthesiologist) {
                setEditingDefault(updatedAnesthesiologist);
            } else {
                setEditingDefault(null);
            }
        }
    }, [anesthesiologists, editingDefault?.id]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = new Date(e.target.value);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        setSelectedDate(new Date(date.getTime() + userTimezoneOffset));
    };

    const handleAddNew = async () => {
        setAddError('');
        if (newEmail.trim()) {
            try {
                await addAnesthesiologist(newEmail.trim());
                setNewEmail('');
                setIsAdding(false);
            } catch (error) {
                setAddError((error as Error).message);
            }
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir este anestesista? Isso também o removerá de todos os plantões anuais.")) {
            deleteAnesthesiologist(id);
        }
    };

    const getStatusClasses = (status?: AvailabilityStatus) => {
        switch (status) {
            case AvailabilityStatus.DayOff: return 'bg-yellow-500 text-white';
            case AvailabilityStatus.Vacation: return 'bg-pink-500 text-white';
            case AvailabilityStatus.Leave: return 'bg-red-500 text-white';
            default: return 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100';
        }
    };
    
    const getAvailabilityDetails = useCallback((anesthesiologist: Anesthesiologist, period: TimePeriod): { status: AvailabilityStatus, source: AvailabilitySource } => {
        const date = selectedDate;
        const dateString = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();

        // 1. Vacation check (highest priority, Mon-Fri only)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            const dateCopy = new Date(date.getTime());
            const dayDiff = date.getDay() - 1; // 0 for Mon, 1 for Tue etc. if week starts Mon
            dateCopy.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Go back to Monday
            const weekStartDateStr = dateCopy.toISOString().split('T')[0];

            if (vacationSchedule[weekStartDateStr]?.includes(anesthesiologist.id)) {
                return { status: AvailabilityStatus.Vacation, source: AvailabilitySource.Vacation };
            }
        }

        const specificStatus = anesthesiologist.availability[dateString]?.[period];
        if (specificStatus) {
            return { status: specificStatus, source: AvailabilitySource.Manual };
        }

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
                const isOnCall = weekendOnCallSchedule[weekendStartDateStr].some(a => a.id === anesthesiologist.id);
                return {
                    status: isOnCall ? AvailabilityStatus.Available : AvailabilityStatus.DayOff,
                    source: AvailabilitySource.OnCall
                };
            }
        }

        const defaultStatus = anesthesiologist.defaultAvailability?.[dayOfWeek]?.[period];
        if (defaultStatus) {
            return { status: defaultStatus, source: AvailabilitySource.Default };
        }

        return { status: AvailabilityStatus.Available, source: AvailabilitySource.System };
    }, [selectedDate, vacationSchedule, weekendOnCallSchedule]);
    
    const isCurrentUserOnCall = useMemo(() => {
        if (!isToday) return false;
        const currentUserAnesthesiologist = anesthesiologists.find(anes => anes.uid === user.uid);
        if (!currentUserAnesthesiologist) return false;

        const { status } = getAvailabilityDetails(currentUserAnesthesiologist, TimePeriod.Night);
        return status === AvailabilityStatus.Available;
    }, [anesthesiologists, user, isToday, getAvailabilityDetails]);

    const weekends = useMemo(() => {
        const year = selectedDate.getFullYear();
        const weekendList: { startDate: Date, dateStr: string }[] = [];
        let currentDate = new Date(year, 0, 1);

        // Find the first Friday of the year
        while (currentDate.getDay() !== 5) {
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Iterate through the year, adding each Friday
        while (currentDate.getFullYear() === year) {
            const weekendDate = new Date(currentDate);
            weekendList.push({
                startDate: weekendDate,
                dateStr: weekendDate.toISOString().split('T')[0]
            });
            currentDate.setDate(currentDate.getDate() + 7);
        }
        return weekendList;
    }, [selectedDate]);

    const weeksOfYear = useMemo(() => {
        const year = selectedDate.getFullYear();
        const weeksList = [];
        const firstDayOfYear = new Date(year, 0, 1);
        
        let currentMonday = new Date(firstDayOfYear);
        // Find the Monday of the first week of the year
        const dayOfWeek = firstDayOfYear.getDay(); // 0=Sun, 1=Mon
        const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        currentMonday.setDate(firstDayOfYear.getDate() + offset);


        while (currentMonday.getFullYear() <= year) {
            if(currentMonday.getFullYear() === year) {
                 weeksList.push({
                    startDate: new Date(currentMonday),
                    dateStr: currentMonday.toISOString().split('T')[0],
                });
            }
            currentMonday.setDate(currentMonday.getDate() + 7);
        }
        return weeksList;
    }, [selectedDate]);


    const handleExportPDF = () => {
        const year = selectedDate.getFullYear();
        const anesthesiologistMap = new Map(anesthesiologists.map(a => [a.id, a.name]));
    
        const groupedByMonth = weekends.reduce((acc, { startDate, dateStr }) => {
            const month = startDate.toLocaleString('pt-BR', { month: 'long' });
            if (!acc[month]) {
                acc[month] = [];
            }
            acc[month].push({ startDate, dateStr });
            return acc;
        }, {} as Record<string, { startDate: Date; dateStr: string }[]>);
    
        let content = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Escala Anual de Plantões ${year}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; }
                    @page { size: A4; margin: 2cm; }
                    h1 { text-align: center; color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                    h2 { color: #222; margin-top: 30px; border-bottom: 1px solid #f0f0f0; padding-bottom: 5px; text-transform: capitalize; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f8f8f8; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>Escala Anual de Plantões de Fim de Semana - ${year}</h1>
        `;
    
        for (const month in groupedByMonth) {
            const monthRowsContent = groupedByMonth[month].map(({ startDate, dateStr }) => {
                const formattedDate = startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                const assignments = weekendOnCallSchedule[dateStr] || [];
    
                // Filter for new-style assignments only (must be an object with an id and a role)
                const validAssignments = assignments.filter(
                    (a): a is OnCallAssignment => typeof a === 'object' && a !== null && !!a.id && !!a.role
                );
    
                if (validAssignments.length === 0) {
                    return ''; // Return empty string to be filtered out
                }
                
                const onCallNames = validAssignments
                    .map(assignment => {
                        const name = anesthesiologistMap.get(assignment.id) || 'Desconhecido';
                        const role = assignment.role;
                        const color = role === OnCallRole.P1S || role === OnCallRole.P2S ? '#D32F2F' : '#388E3C';
                        return `${name} (<span style="color: ${color}; font-weight: bold;">${role}</span>)`;
                    })
                    .join(', ');
    
                return `
                    <tr>
                        <td>A partir de ${formattedDate}</td>
                        <td>${onCallNames}</td>
                    </tr>
                `;
            }).join('');
    
            if (monthRowsContent) {
                content += `<h2>${month}</h2>`;
                content += '<table><thead><tr><th>Fim de Semana</th><th>Plantonistas</th></tr></thead><tbody>';
                content += monthRowsContent;
                content += '</tbody></table>';
            }
        }
    
        content += `</body></html>`;
    
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.onafterprint = () => printWindow.close();
        }
    };
    
    const handleExportVacationPDF = () => {
        const year = selectedDate.getFullYear();
        const anesthesiologistMap = new Map(anesthesiologists.map(a => [a.id, a.name]));

        const groupedByMonth = weeksOfYear.reduce((acc, { startDate, dateStr }) => {
            const month = startDate.toLocaleString('pt-BR', { month: 'long' });
            if (!acc[month]) {
                acc[month] = [];
            }
            acc[month].push({ startDate, dateStr });
            return acc;
        }, {} as Record<string, { startDate: Date; dateStr: string }[]>);

        let content = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório Anual de Férias ${year}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.5; color: #333; }
                    @page { size: A4; margin: 2cm; }
                    h1 { text-align: center; color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                    h2 { color: #222; margin-top: 25px; border-bottom: 1px solid #f0f0f0; padding-bottom: 5px; text-transform: capitalize; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
                    th { background-color: #f8f8f8; font-weight: bold; }
                    td ul { margin: 0; padding-left: 18px; }
                    td li { margin-bottom: 4px; }
                    .no-vacation { color: #888; font-style: italic; }
                </style>
            </head>
            <body>
                <h1>Relatório Anual de Férias - ${year}</h1>
        `;

        const monthOrder = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

        monthOrder.forEach(monthName => {
            if (groupedByMonth[monthName]) {
                content += `<h2>${monthName}</h2>`;
                content += '<table><thead><tr><th style="width: 35%;">Semana (Seg-Sex)</th><th>Anestesistas em Férias</th></tr></thead><tbody>';
                
                const monthRowsContent = groupedByMonth[monthName].map(({ startDate, dateStr }) => {
                    const weekEndDate = new Date(startDate);
                    weekEndDate.setDate(startDate.getDate() + 4); // Monday to Friday
                    const formattedWeek = `${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${weekEndDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
                    
                    const vacationerIds = vacationSchedule[dateStr] || [];
                    const vacationerNames = vacationerIds.map(id => anesthesiologistMap.get(id) || 'Desconhecido');

                    let vacationersList;
                    if (vacationerNames.length > 0) {
                        vacationersList = `<ul>${vacationerNames.map(name => `<li>${name}</li>`).join('')}</ul>`;
                    } else {
                        vacationersList = `<span class="no-vacation">Ninguém</span>`;
                    }

                    return `
                        <tr>
                            <td>${formattedWeek}</td>
                            <td>${vacationersList}</td>
                        </tr>
                    `;
                }).join('');

                content += monthRowsContent;
                content += '</tbody></table>';
            }
        });
    
        content += `</body></html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.onafterprint = () => printWindow.close();
        }
    };


    return (
        <Fragment>
            {editingDefault && <DefaultAvailabilityModal 
                anesthesiologist={editingDefault}
                onClose={() => setEditingDefault(null)}
                onSave={updateDefaultAvailability}
                isReadOnly={isReadOnly}
            />}
            {editingAnesthesiologist && isAdmin && (
                <EditAnesthesiologistModal
                    isOpen={!!editingAnesthesiologist}
                    onClose={() => setEditingAnesthesiologist(null)}
                    anesthesiologist={editingAnesthesiologist}
                    onSave={updateAnesthesiologist}
                    allUsers={allUsers}
                />
            )}
             {isCalendarModalOpen && <OnCallCalendarModal
                isOpen={isCalendarModalOpen}
                onClose={() => setIsCalendarModalOpen(false)}
                anesthesiologists={anesthesiologists}
                schedule={weekendOnCallSchedule}
                onUpdate={updateWeekendOnCall}
                isReadOnly={!isAdmin}
                weekends={weekends}
            />}
             {isVacationModalOpen && <VacationCalendarModal
                isOpen={isVacationModalOpen}
                onClose={() => setIsVacationModalOpen(false)}
                anesthesiologists={anesthesiologists}
                schedule={vacationSchedule}
                onUpdate={updateVacationSchedule}
                isReadOnly={!isAdmin}
                weeks={weeksOfYear}
            />}
            {isReportModalOpen && <WorkloadReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                anesthesiologists={anesthesiologists}
                extraPeriods={extraPeriods}
                weekendOnCallSchedule={weekendOnCallSchedule}
                user={user}
                isAdmin={isAdmin}
                deleteExtraPeriod={deleteExtraPeriod}
            />}
            {extraPeriodModalState.isOpen && <AddExtraPeriodModal
                anesthesiologist={extraPeriodModalState.anesthesiologist}
                date={selectedDate}
                onClose={() => setExtraPeriodModalState({ isOpen: false, anesthesiologist: null })}
                onSave={addExtraPeriod}
            />}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <div className="flex-grow">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Gerenciar Equipe e Disponibilidade</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Defina a disponibilidade diária ou configure a escala anual de plantões.</p>
                    </div>
                     <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            className="w-full sm:w-auto text-white bg-teal-600 hover:bg-teal-700 font-medium rounded-lg text-sm px-4 py-2.5 text-center flex items-center justify-center gap-2"
                            title="Ver relatório de carga de trabalho mensal"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>
                           Relatório Mensal
                        </button>
                        <button 
                            onClick={handleExportVacationPDF} 
                            className="w-full sm:w-auto text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 font-medium rounded-lg text-sm px-4 py-2.5 text-center flex items-center justify-center gap-2"
                            title="Exportar o relatório anual de férias como PDF"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg>
                            Férias Anuais (pdf)
                        </button>
                        <button 
                            onClick={handleExportPDF} 
                            className="w-full sm:w-auto text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 font-medium rounded-lg text-sm px-4 py-2.5 text-center flex items-center justify-center gap-2"
                            title="Exportar a escala anual de plantões de fim de semana como PDF"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg>
                            Plantões fins de semana (pdf)
                        </button>
                         {isAdmin && (
                            <>
                                <button
                                    onClick={() => setIsVacationModalOpen(true)}
                                    className="w-full sm:w-auto text-white bg-sky-600 hover:bg-sky-700 font-medium rounded-lg text-sm px-4 py-2.5 text-center flex items-center justify-center gap-2"
                                    title="Gerenciar o cronograma de férias semanais para o ano"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 014 0v.182C16.155 10.51 14.988 12 13.5 12h-1a1.5 1.5 0 000 3h1a1.5 1.5 0 011.5 1.5v.558c-.468.212-.96.38-1.484.487a4.008 4.008 0 01-5.032 0 4.004 4.004 0 01-1.484-.487v-.558A1.5 1.5 0 017.5 15h1a1.5 1.5 0 000-3h-1A1.5 1.5 0 016 10.5V10c0-.526.27-1 .668-1.973z" clipRule="evenodd" /></svg>
                                    Gerenciar Férias
                                </button>
                                <button
                                    onClick={() => setIsCalendarModalOpen(true)}
                                    className="w-full sm:w-auto text-white bg-purple-600 hover:bg-purple-700 font-medium rounded-lg text-sm px-4 py-2.5 text-center flex items-center justify-center gap-2"
                                    title="Configurar escala de plantão para todos os fins de semana do ano"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7a1 1 0 011.414-1.414L8 14.586V3a1 1 0 112 0v11.586l5.293-5.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    Editar Plantões Anuais
                                </button>
                            </>
                         )}
                        <input
                            type="date"
                            value={selectedDate.toISOString().split('T')[0]}
                            onChange={handleDateChange}
                            className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-auto p-2.5"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">Anestesista</th>
                                <th scope="col" className="px-4 py-3 text-center">Manhã</th>
                                <th scope="col" className="px-4 py-3 text-center">Tarde</th>
                                <th scope="col" className="px-4 py-3 text-center">Noite</th>
                                <th scope="col" className="px-4 py-3 text-center">Ações</th>
                                <th scope="col" className="px-2 py-3 text-center">Extras</th>
                            </tr>
                        </thead>
                        <tbody>
                            {anesthesiologists.map(a => {
                                const { status: nightStatus } = getAvailabilityDetails(a, TimePeriod.Night);
                                const isThisPersonOnCall = nightStatus === AvailabilityStatus.Available;
                                
                                const showAddExtraButton = isToday && !isReadOnly && isCurrentUserOnCall && !isThisPersonOnCall;

                                return (
                                <tr key={a.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                        {a.name}
                                    </td>
                                    {(Object.values(TimePeriod) as TimePeriod[]).map(period => {
                                        const { status: currentStatus, source } = getAvailabilityDetails(a, period);
                                        const fromOnCall = source === AvailabilitySource.OnCall;
                                        const fromDefault = source === AvailabilitySource.Default;
                                        const fromVacation = source === AvailabilitySource.Vacation;

                                        return (
                                        <td key={period} className="px-4 py-2">
                                            <select
                                                value={currentStatus}
                                                onChange={(e) => updateAvailability(a.id, selectedDate, period, e.target.value as AvailabilityStatus)}
                                                disabled={isReadOnly || fromVacation}
                                                className={`border text-sm rounded-lg block w-full p-1.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    currentStatus === AvailabilityStatus.Available 
                                                    ? 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100' 
                                                    : `${getStatusClasses(currentStatus)} border-transparent font-semibold`
                                                } ${fromVacation ? 'opacity-75 ring-2 ring-sky-400' : fromOnCall ? 'opacity-75 ring-2 ring-purple-400' : fromDefault ? 'opacity-75 ring-2 ring-gray-400' : ''}`}
                                                title={
                                                    fromVacation ? "Indisponibilidade definida pelo Calendário de Férias" :
                                                    fromOnCall ? "Disponibilidade definida pelo Calendário Anual de Plantões" : 
                                                    fromDefault ? "Disponibilidade definida pela escala padrão" : 
                                                    "Disponibilidade manual ou padrão do sistema"
                                                }
                                            >
                                                {Object.values(AvailabilityStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        )
                                    })}
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex items-center justify-center space-x-1">
                                            <button onClick={() => setEditingDefault(a)} title="Editar Disponibilidade Padrão" className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" /></svg></button>
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => setEditingAnesthesiologist(a)} title="Editar Anestesista" className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg></button>
                                                    <button onClick={() => handleDelete(a.id)} title="Excluir" className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                     <td className="px-2 py-2 text-center">
                                        {showAddExtraButton && (
                                            <button 
                                                onClick={() => setExtraPeriodModalState({ isOpen: true, anesthesiologist: a })}
                                                className="p-1.5 rounded-full text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800"
                                                title={`Adicionar período extra para ${a.name}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )})}
                            {isAdding && (
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                    <td className="px-6 py-4" colSpan={1}>
                                        <input
                                            type="email"
                                            value={newEmail}
                                            onChange={(e) => { setNewEmail(e.target.value); setAddError(''); }}
                                            placeholder="E-mail do novo usuário"
                                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddNew()}
                                        />
                                        {addError && <p className="text-red-500 text-xs mt-1">{addError}</p>}
                                    </td>
                                    <td colSpan={3}></td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-1">
                                            <button onClick={handleAddNew} title="Confirmar" className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                                            <button onClick={() => { setIsAdding(false); setNewEmail(''); setAddError(''); }} title="Cancelar" className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                        </div>
                                    </td>
                                    <td></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                 {!isAdding && isAdmin && (
                    <div className="mt-4">
                        <button
                            onClick={() => setIsAdding(true)}
                            className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-2"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            Adicionar Membro da Equipe
                        </button>
                    </div>
                )}
            </div>
        </Fragment>
    );
};

export default AvailabilityManager;