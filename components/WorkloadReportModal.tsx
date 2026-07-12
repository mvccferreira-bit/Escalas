import React, { useState, useMemo } from 'react';
import { Anesthesiologist, ExtraPeriod, AvailabilityStatus, TimePeriod, OnCallAssignment } from '../types';
import ExtraPeriodDetailsModal from './ExtraPeriodDetailsModal';
import { User } from 'firebase/auth';

interface WorkloadReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    anesthesiologists: Anesthesiologist[];
    extraPeriods: ExtraPeriod[];
    weekendOnCallSchedule: { [date: string]: OnCallAssignment[] };
    user: User;
    isAdmin: boolean;
    deleteExtraPeriod: (periodId: string) => Promise<void>;
}

interface DetailsModalData {
    anesthesiologistName: string;
    periods: ExtraPeriod[];
}


const WorkloadReportModal: React.FC<WorkloadReportModalProps> = ({ isOpen, onClose, anesthesiologists, extraPeriods, weekendOnCallSchedule, user, isAdmin, deleteExtraPeriod }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [detailsModalData, setDetailsModalData] = useState<DetailsModalData | null>(null);

    const userMap = useMemo(() => {
        const map = new Map<string, string>();
        anesthesiologists.forEach(a => {
            if (a.uid) {
                map.set(a.uid, a.name);
            }
        });
        return map;
    }, [anesthesiologists]);

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getAvailabilityForDay = (anesthesiologist: Anesthesiologist, period: TimePeriod, date: Date): AvailabilityStatus => {
        const dateString = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();

        const specificStatus = anesthesiologist.availability[dateString]?.[period];
        if (specificStatus) return specificStatus;

        let weekendStartDateStr: string | null = null;
        if (dayOfWeek === 5) weekendStartDateStr = dateString;
        else if (dayOfWeek === 6) weekendStartDateStr = new Date(date.getTime() - (1 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        else if (dayOfWeek === 0) weekendStartDateStr = new Date(date.getTime() - (2 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        
        if (weekendStartDateStr && weekendOnCallSchedule[weekendStartDateStr]) {
            const isWithinOnCallPeriod = ((dayOfWeek === 5 && period === TimePeriod.Night) || dayOfWeek === 6 || dayOfWeek === 0);
            if (isWithinOnCallPeriod) {
                return weekendOnCallSchedule[weekendStartDateStr].some(a => a.id === anesthesiologist.id) ? AvailabilityStatus.Available : AvailabilityStatus.DayOff;
            }
        }

        return anesthesiologist.defaultAvailability?.[dayOfWeek]?.[period] || AvailabilityStatus.Available;
    };

    const workloadData = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const numDays = getDaysInMonth(year, month);
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        const report = new Map<string, { morning: number; afternoon: number; night: number; extras: number; negative: number; total: number; }>();

        anesthesiologists.forEach(a => {
            report.set(a.id, { morning: 0, afternoon: 0, night: 0, extras: 0, negative: 0, total: 0 });
        });

        for (let day = 1; day <= numDays; day++) {
            const currentDate = new Date(year, month, day);
            const dayOfWeek = currentDate.getDay();

            anesthesiologists.forEach(a => {
                const counts = report.get(a.id)!;
                [TimePeriod.Morning, TimePeriod.Afternoon, TimePeriod.Night].forEach(period => {
                    const isWeekendPeriod = (dayOfWeek === 6) || (dayOfWeek === 0) || (dayOfWeek === 5 && period === TimePeriod.Night);
                    
                    const status = getAvailabilityForDay(a, period, currentDate);

                    if (status === AvailabilityStatus.Available) {
                        // Apenas contabiliza períodos disponíveis se for um dia de semana
                        if (!isWeekendPeriod) {
                            if (period === TimePeriod.Morning) counts.morning++;
                            else if (period === TimePeriod.Afternoon) counts.afternoon++;
                            else counts.night++;
                        }
                    } else if (status === AvailabilityStatus.Leave) {
                        // Contabiliza afastamentos independentemente do dia
                        counts.negative++;
                    }
                });
            });
        }
        
        extraPeriods.forEach(ep => {
            if (ep.date.startsWith(monthStr)) {
                const counts = report.get(ep.anesthesiologistId);
                if (counts) {
                    counts.extras++;
                }
            }
        });

        report.forEach(counts => {
            counts.total = (counts.morning + counts.afternoon + counts.night + counts.extras) - counts.negative;
        });
        
        return Array.from(report.entries()).map(([id, counts]) => ({
            anesthesiologist: anesthesiologists.find(a => a.id === id)!,
            counts,
        }));
    }, [selectedDate, anesthesiologists, extraPeriods, weekendOnCallSchedule]);

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [year, month] = e.target.value.split('-').map(Number);
        setSelectedDate(new Date(year, month - 1, 1));
    };

    const handleShowDetails = (anesthesiologist: Anesthesiologist) => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        const periodsForAnesthesiologist = extraPeriods.filter(
            ep => ep.anesthesiologistId === anesthesiologist.id && ep.date.startsWith(monthStr)
        );

        setDetailsModalData({
            anesthesiologistName: anesthesiologist.name,
            periods: periodsForAnesthesiologist
        });
    };
    
    if (!isOpen) return null;

    return (
        <>
             <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[49] p-4" onClick={onClose}>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Relatório Mensal de Carga de Trabalho</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Contagem de períodos trabalhados, extras e afastamentos.
                            </p>
                        </div>
                         <input
                            type="month"
                            value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
                            onChange={handleMonthChange}
                            className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                        />
                    </header>

                    <main className="p-6 overflow-y-auto flex-grow">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                 <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">Anestesista</th>
                                        <th className="px-4 py-3 text-center">Manhãs</th>
                                        <th className="px-4 py-3 text-center">Tardes</th>
                                        <th className="px-4 py-3 text-center">Noites</th>
                                        <th className="px-4 py-3 text-center">Extras</th>
                                        <th className="px-4 py-3 text-center">Afastamentos</th>
                                        <th className="px-4 py-3 text-center font-bold">Total Ponderado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workloadData.sort((a,b) => a.anesthesiologist.name.localeCompare(b.anesthesiologist.name)).map(({ anesthesiologist, counts }) => (
                                        <tr key={anesthesiologist.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{anesthesiologist.name}</td>
                                            <td className="px-4 py-2 text-center">{counts.morning}</td>
                                            <td className="px-4 py-2 text-center">{counts.afternoon}</td>
                                            <td className="px-4 py-2 text-center">{counts.night}</td>
                                            <td className="px-4 py-2 text-center">
                                                {counts.extras > 0 ? (
                                                    <button
                                                        onClick={() => handleShowDetails(anesthesiologist)}
                                                        className="font-semibold text-green-600 dark:text-green-400 hover:underline focus:outline-none"
                                                        title="Ver detalhes dos períodos extras"
                                                    >
                                                        {counts.extras}
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-500 dark:text-gray-400">{counts.extras}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-center text-red-600 dark:text-red-400 font-semibold">{counts.negative}</td>
                                            <td className="px-4 py-2 text-center font-bold text-lg text-blue-800 dark:text-blue-300">{counts.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </main>
                    
                    <footer className="p-4 border-t dark:border-gray-700 flex justify-end">
                        <button onClick={onClose} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">
                            Fechar
                        </button>
                    </footer>
                </div>
            </div>
            <ExtraPeriodDetailsModal
                isOpen={!!detailsModalData}
                onClose={() => setDetailsModalData(null)}
                data={detailsModalData}
                userMap={userMap}
                onDelete={deleteExtraPeriod}
                currentUser={user}
                isAdmin={isAdmin}
            />
        </>
    );
};

export default WorkloadReportModal;