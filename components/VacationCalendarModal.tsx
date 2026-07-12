import React from 'react';
import { Anesthesiologist, VacationSchedule } from '../types';

interface VacationCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    anesthesiologists: Anesthesiologist[];
    schedule: VacationSchedule;
    onUpdate: (weekStartDate: string, anesthesiologistId: string, isOnVacation: boolean) => void;
    isReadOnly: boolean;
    weeks: { startDate: Date, dateStr: string }[];
}

const VacationCalendarModal: React.FC<VacationCalendarModalProps> = ({ isOpen, onClose, anesthesiologists, schedule, onUpdate, isReadOnly, weeks }) => {
    
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gerenciar Calendário Anual de Férias</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Selecione os anestesistas de férias para cada semana. Isso definirá automaticamente a disponibilidade deles como <strong className="font-semibold">'Férias'</strong> de Segunda a Sexta-feira na semana correspondente.
                    </p>
                </header>

                <main className="p-6 overflow-y-auto flex-grow">
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {weeks.map(({ startDate, dateStr }) => {
                            const formattedDate = startDate.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
                            return (
                                <div key={dateStr} className="flex flex-col p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-600">
                                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                                        Semana de <span className="font-semibold">{formattedDate}</span>
                                    </label>
                                    <fieldset disabled={isReadOnly} className="space-y-2 disabled:opacity-50">
                                        {anesthesiologists.length > 0 ? anesthesiologists.map(a => {
                                            const isChecked = schedule[dateStr]?.includes(a.id) || false;

                                            return (
                                                <div key={a.id} className="flex items-center justify-between">
                                                    <div className="flex items-center">
                                                        <input
                                                            id={`vacation-cb-${dateStr}-${a.id}`}
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                onUpdate(dateStr, a.id, e.target.checked);
                                                            }}
                                                            className="w-4 h-4 text-sky-600 bg-gray-100 border-gray-300 rounded focus:ring-sky-500 dark:focus:ring-sky-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-600 dark:border-gray-500 disabled:cursor-not-allowed"
                                                        />
                                                        <label htmlFor={`vacation-cb-${dateStr}-${a.id}`} className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                                                            {a.name}
                                                        </label>
                                                    </div>
                                                </div>
                                            )
                                        }) : <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum anestesista cadastrado.</p>}
                                    </fieldset>
                                </div>
                            );
                        })}
                    </div>
                </main>
                
                <footer className="p-4 border-t dark:border-gray-700 flex justify-end items-center gap-3">
                    <button onClick={onClose} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">
                        Fechar
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default VacationCalendarModal;