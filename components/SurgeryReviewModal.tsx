import React, { useState, useEffect } from 'react';
import { ExtractedSurgeryData } from '../services/geminiService';

interface SurgeryReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (surgeriesToImport: ExtractedSurgeryData[]) => void;
    surgeries: ExtractedSurgeryData[];
}

const SurgeryReviewModal: React.FC<SurgeryReviewModalProps> = ({ isOpen, onClose, onConfirm, surgeries }) => {
    const [selectedSurgeries, setSelectedSurgeries] = useState<ExtractedSurgeryData[]>([]);

    useEffect(() => {
        if (surgeries) {
            setSelectedSurgeries(surgeries);
        }
    }, [surgeries]);

    if (!isOpen) return null;

    const handleCheckboxChange = (surgery: ExtractedSurgeryData, isChecked: boolean) => {
        if (isChecked) {
            setSelectedSurgeries(prev => [...prev, surgery]);
        } else {
            setSelectedSurgeries(prev => prev.filter(s => s !== surgery));
        }
    };
    
    const handleSelectAll = (isChecked: boolean) => {
        if (isChecked) {
            setSelectedSurgeries(surgeries);
        } else {
            setSelectedSurgeries([]);
        }
    };

    const handleSubmit = () => {
        onConfirm(selectedSurgeries);
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Revisar Cirurgias Extraídas
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                       Selecione as cirurgias que você deseja adicionar à escala do dia.
                    </p>
                </header>
                <main className="p-6 overflow-y-auto flex-grow">
                    {surgeries.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400">Nenhuma cirurgia compatível (Anestesia 'GAP' com horário definido) foi encontrada na imagem.</p>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th className="p-2 w-8">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600"
                                            checked={selectedSurgeries.length === surgeries.length}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th className="px-4 py-2">Horário</th>
                                    <th className="px-4 py-2">Cirurgia</th>
                                    <th className="px-4 py-2">Cirurgião</th>
                                </tr>
                            </thead>
                             <tbody>
                                {surgeries.map((s, index) => (
                                     <tr key={index} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                         <td className="p-2">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600"
                                                checked={selectedSurgeries.includes(s)}
                                                onChange={(e) => handleCheckboxChange(s, e.target.checked)}
                                            />
                                         </td>
                                         <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">{s.startTime}</td>
                                         <td className="px-4 py-2">{s.name}</td>
                                         <td className="px-4 py-2">{s.surgeon}</td>
                                     </tr>
                                ))}
                             </tbody>
                        </table>
                    </div>
                    )}
                </main>
                 <footer className="p-4 border-t dark:border-gray-700 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-600"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={selectedSurgeries.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                        Adicionar {selectedSurgeries.length} Cirurgias
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SurgeryReviewModal;
