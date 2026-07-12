import React, { useState } from 'react';
import { Anesthesiologist, TimePeriod } from '../types';

interface AddExtraPeriodModalProps {
    anesthesiologist: Anesthesiologist | null;
    date: Date;
    onClose: () => void;
    onSave: (anesthesiologistId: string, date: Date, period: TimePeriod) => Promise<void>;
}

const AddExtraPeriodModal: React.FC<AddExtraPeriodModalProps> = ({ anesthesiologist, date, onClose, onSave }) => {
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(TimePeriod.Morning);
    const [isLoading, setIsLoading] = useState(false);

    if (!anesthesiologist) return null;

    const handleSubmit = async () => {
        const confirmationMessage = `Você confirma a adição de um período extra (${selectedPeriod}) para ${anesthesiologist.name} na data ${date.toLocaleDateString('pt-BR')}?`;

        if (window.confirm(confirmationMessage)) {
            setIsLoading(true);
            try {
                await onSave(anesthesiologist.id, date, selectedPeriod);
                onClose();
            } catch (error) {
                console.error("Failed to save extra period:", error);
                alert("Ocorreu um erro ao salvar o período extra.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Adicionar Período Extra</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Para: <span className="font-semibold">{anesthesiologist.name}</span> <br/>
                    Data: <span className="font-semibold">{date.toLocaleDateString()}</span>
                </p>
                
                <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-300">Selecione o período trabalhado:</p>
                    {(Object.values(TimePeriod) as TimePeriod[]).map(period => (
                         <div key={period} className="flex items-center">
                            <input
                                id={`period-${period}`}
                                name="period"
                                type="radio"
                                value={period}
                                checked={selectedPeriod === period}
                                onChange={() => setSelectedPeriod(period)}
                                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <label htmlFor={`period-${period}`} className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {period}
                            </label>
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-600"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none disabled:bg-blue-400"
                    >
                        {isLoading ? 'Salvando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddExtraPeriodModal;