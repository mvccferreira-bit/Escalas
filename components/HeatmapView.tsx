import React, { useMemo, useState } from 'react';
import { Surgery } from '../types';

interface HeatmapViewProps {
    surgeries: Surgery[];
    selectedDate: Date; // This will now act as the reference date for all ranges
}

type RangeOption = 'week' | 'month' | '6months' | '12months';

const formatTime = (minutes: number): string => {
    if (minutes <= 1) return ''; // Don't show for tiny values
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0 && mins > 0) {
        return `${hours}h ${mins}m`;
    }
    if (hours > 0) {
        return `${hours}h`;
    }
    return `${mins}m`;
};

const HeatmapView: React.FC<HeatmapViewProps> = ({ surgeries, selectedDate }) => {
    const [range, setRange] = useState<RangeOption>('week');
    const [currentMonth, setCurrentMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });

    const { heatmapData, maxWorkload, rangeLabel } = useMemo(() => {
        let startDate: Date;
        let endDate: Date;
        let label: string;
        
        const referenceDate = new Date(selectedDate);
        
        switch(range) {
            case 'month':
                const [year, month] = currentMonth.split('-').map(Number);
                startDate = new Date(year, month - 1, 1);
                endDate = new Date(year, month, 0, 23, 59, 59, 999);
                label = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                break;
            case '6months':
                endDate = new Date(referenceDate);
                endDate.setHours(23, 59, 59, 999);
                startDate = new Date(referenceDate);
                startDate.setMonth(startDate.getMonth() - 6);
                startDate.setDate(1);
                startDate.setHours(0, 0, 0, 0);
                label = `Últimos 6 Meses (${startDate.toLocaleDateString('pt-BR', {month: 'short'})} - ${endDate.toLocaleDateString('pt-BR', {month: 'short', year: 'numeric'})})`;
                break;
            case '12months':
                endDate = new Date(referenceDate);
                endDate.setHours(23, 59, 59, 999);
                startDate = new Date(referenceDate);
                startDate.setMonth(startDate.getMonth() - 12);
                startDate.setDate(1);
                startDate.setHours(0, 0, 0, 0);
                label = `Últimos 12 Meses (${startDate.toLocaleDateString('pt-BR', {month: 'short', year: 'numeric'})} - ${endDate.toLocaleDateString('pt-BR', {month: 'short', year: 'numeric'})})`;
                break;
            case 'week':
            default:
                startDate = new Date(referenceDate);
                const day = startDate.getDay();
                const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
                startDate.setDate(diff);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                
                const formatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
                label = `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
                break;
        }

        const filteredSurgeries = surgeries.filter(s => {
            // Use the date object directly for comparison
            return s.date >= startDate && s.date <= endDate && s.startTime;
        });

        const data: number[][] = Array(8).fill(0).map(() => Array(7).fill(0));
        let currentMax = 0;

        filteredSurgeries.forEach(surgery => {
            // Use the date object directly to get the day
            const dayIndex = surgery.date.getDay();
            const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Mon=0, ..., Sun=6
            
            const hour = parseInt(surgery.startTime!.split(':')[0], 10);
            const periodIndex = Math.floor(hour / 3); // 0-2h -> 0, 3-5h -> 1, ... 21-23h -> 7

            if (data[periodIndex] && data[periodIndex][adjustedDayIndex] !== undefined) {
                data[periodIndex][adjustedDayIndex] += surgery.estimatedTime;
                if (data[periodIndex][adjustedDayIndex] > currentMax) {
                    currentMax = data[periodIndex][adjustedDayIndex];
                }
            }
        });

        return { heatmapData: data, maxWorkload: currentMax, rangeLabel: label };
    }, [surgeries, selectedDate, range, currentMonth]);
    
    const getColorClass = (workload: number): string => {
        if (workload === 0 || maxWorkload === 0) {
            return 'bg-gray-100 dark:bg-gray-700/50';
        }
        const percentage = workload / maxWorkload;
        if (percentage <= 0.2) return 'bg-sky-200 dark:bg-sky-900';
        if (percentage <= 0.4) return 'bg-green-300 dark:bg-green-800';
        if (percentage <= 0.6) return 'bg-yellow-300 dark:bg-yellow-700';
        if (percentage <= 0.8) return 'bg-orange-400 dark:bg-orange-600';
        return 'bg-red-500 dark:bg-red-500';
    };
    
    const timePeriods = [
        '00:00 - 02:59', '03:00 - 05:59', '06:00 - 08:59', '09:00 - 11:59',
        '12:00 - 14:59', '15:00 - 17:59', '18:00 - 20:59', '21:00 - 23:59'
    ];
    
    const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    const legendColors = [
        { label: 'Baixa', class: 'bg-sky-200 dark:bg-sky-900' },
        { label: '', class: 'bg-green-300 dark:bg-green-800' },
        { label: 'Média', class: 'bg-yellow-300 dark:bg-yellow-700' },
        { label: '', class: 'bg-orange-400 dark:bg-orange-600' },
        { label: 'Alta', class: 'bg-red-500 dark:bg-red-500' },
    ];
    
    const rangeOptions: { key: RangeOption, label: string }[] = [
        { key: 'week', label: '1 Semana'},
        { key: 'month', label: '1 Mês'},
        { key: '6months', label: '6 Meses'},
        { key: '12months', label: '12 Meses'},
    ];
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Mapa de Calor da Carga Cirúrgica</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{rangeLabel}</p>
                </div>
                 <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Carga:</span>
                    <span className="text-xs">Baixa</span>
                    {legendColors.map((item, index) => (
                       <div key={index} className={`w-4 h-4 rounded ${item.class}`}></div>
                    ))}
                    <span className="text-xs">Alta</span>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Período:</span>
                     {rangeOptions.map(opt => (
                        <button 
                            key={opt.key}
                            onClick={() => setRange(opt.key)}
                            className={`px-3 py-1 text-sm rounded-md ${range === opt.key ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {range === 'month' && (
                    <input
                        type="month"
                        value={currentMonth}
                        onChange={(e) => setCurrentMonth(e.target.value)}
                        className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5"
                    />
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-center">
                    <thead>
                        <tr>
                            <th className="p-2 border dark:border-gray-600 w-28">Período</th>
                            {daysOfWeek.map(day => (
                                <th key={day} className="p-2 border dark:border-gray-600 font-medium text-sm text-gray-700 dark:text-gray-300">{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timePeriods.map((period, periodIndex) => (
                            <tr key={period}>
                                <td className="p-2 border dark:border-gray-600 font-medium text-xs text-gray-700 dark:text-gray-300">{period}</td>
                                {daysOfWeek.map((_, dayIndex) => {
                                    const workload = heatmapData[periodIndex][dayIndex];
                                    return (
                                        <td
                                            key={dayIndex}
                                            className={`p-2 border dark:border-gray-600 text-sm font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-300 ${getColorClass(workload)}`}
                                            title={`${formatTime(workload)} (${workload} min)`}
                                        >
                                            {formatTime(workload)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default HeatmapView;