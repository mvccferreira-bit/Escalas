import React from 'react';
import { Anesthesiologist, OnCallAssignment, OnCallRole } from '../types';

interface OnCallCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    anesthesiologists: Anesthesiologist[];
    schedule: { [date: string]: OnCallAssignment[] };
    onUpdate: (weekendStartDate: string, anesthesiologistId: string, role: OnCallRole | null) => void;
    isReadOnly: boolean;
    weekends: { startDate: Date, dateStr: string }[];
}

const OnCallCalendarModal: React.FC<OnCallCalendarModalProps> = ({ isOpen, onClose, anesthesiologists, schedule, onUpdate, isReadOnly, weekends }) => {
    
    if (!isOpen) {
        return null;
    }

    const getRoleColor = (role: OnCallRole | undefined) => {
        if (!role) return 'text-gray-900 dark:text-gray-300';
        switch (role) {
            case OnCallRole.P1S:
            case OnCallRole.P2S:
                return 'text-red-600 dark:text-red-400';
            case OnCallRole.P1U:
            case OnCallRole.P2U:
                return 'text-green-600 dark:text-green-400';
            default:
                return 'text-gray-900 dark:text-gray-300';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Editar Calendário Anual de Plantões</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Defina o(s) plantonista(s) para cada fim de semana. Isso ajustará automaticamente a <strong className="font-semibold">disponibilidade específica</strong> de toda a equipe para essas datas.
                    </p>
                </header>

                <main className="p-6 overflow-y-auto flex-grow">
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {weekends.map(({ startDate, dateStr }) => {
                            const formattedDate = startDate.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
                            return (
                                <div key={dateStr} className="flex flex-col p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-600">
                                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                                        Fim de Semana de <span className="font-semibold">{formattedDate}</span>
                                    </label>
                                    <fieldset disabled={isReadOnly} className="space-y-2 disabled:opacity-50">
                                        {anesthesiologists.length > 0 ? anesthesiologists.map(a => {
                                            const assignment = schedule[dateStr]?.find(item => item.id === a.id);
                                            const isChecked = !!assignment;
                                            const currentRole = assignment?.role;

                                            return (
                                                <div key={a.id} className="flex items-center justify-between">
                                                    <div className="flex items-center">
                                                        <input
                                                            id={`cb-${dateStr}-${a.id}`}
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                const newRole = e.target.checked ? OnCallRole.P1S : null; // Default to P1S on check
                                                                onUpdate(dateStr, a.id, newRole);
                                                            }}
                                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-600 dark:border-gray-500 disabled:cursor-not-allowed"
                                                        />
                                                        <label htmlFor={`cb-${dateStr}-${a.id}`} className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                                                            {a.name}
                                                        </label>
                                                    </div>
                                                    {isChecked && (
                                                        <select
                                                            value={currentRole || ''}
                                                            onChange={(e) => onUpdate(dateStr, a.id, e.target.value as OnCallRole)}
                                                            className={`text-xs p-1 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 font-semibold ${getRoleColor(currentRole)}`}
                                                        >
                                                            <option value={OnCallRole.P1S} style={{ color: '#D32F2F' }}>P1S</option>
                                                            <option value={OnCallRole.P2S} style={{ color: '#D32F2F' }}>P2S</option>
                                                            <option value={OnCallRole.P1U} style={{ color: '#388E3C' }}>P1U</option>
                                                            <option value={OnCallRole.P2U} style={{ color: '#388E3C' }}>P2U</option>
                                                        </select>
                                                    )}
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

export default OnCallCalendarModal;