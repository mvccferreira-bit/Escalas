import React from 'react';
import { ExtraPeriod } from '../types';
import { User } from 'firebase/auth';

interface ExtraPeriodDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        anesthesiologistName: string;
        periods: ExtraPeriod[];
    } | null;
    userMap: Map<string | undefined, string>;
    onDelete: (periodId: string) => Promise<void>;
    currentUser: User;
    isAdmin: boolean;
}

const ExtraPeriodDetailsModal: React.FC<ExtraPeriodDetailsModalProps> = ({ isOpen, onClose, data, userMap, onDelete, currentUser, isAdmin }) => {
    if (!isOpen || !data) return null;

    const handleDelete = (periodId: string) => {
        if (window.confirm("Tem certeza que deseja excluir este período extra? A ação não pode ser desfeita.")) {
            onDelete(periodId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Detalhes dos Períodos Extras
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Para: <span className="font-semibold">{data.anesthesiologistName}</span>
                    </p>
                </header>

                <main className="p-6 overflow-y-auto flex-grow">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th className="px-4 py-3">Data</th>
                                    <th className="px-4 py-3">Período</th>
                                    <th className="px-4 py-3">Adicionado Por</th>
                                    <th className="px-4 py-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.periods.length > 0 ? (
                                    data.periods
                                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                        .map(period => {
                                            const canDelete = isAdmin || currentUser.uid === period.addedBy;
                                            return (
                                                <tr key={period.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                                                        {new Date(period.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-2">{period.period}</td>
                                                    <td className="px-4 py-2">{userMap.get(period.addedBy) || 'Usuário desconhecido'}</td>
                                                    <td className="px-4 py-2 text-center">
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDelete(period.id)}
                                                                title="Excluir período extra"
                                                                className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                ) : (
                                    <tr className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                        <td colSpan={4} className="px-4 py-3 text-center text-gray-500 italic">
                                            Nenhum período extra encontrado.
                                        </td>
                                    </tr>
                                )}
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
    );
};

export default ExtraPeriodDetailsModal;