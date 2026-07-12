import React, { useState } from 'react';

interface SelectHospitalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (hospitalName: string) => void;
}

const SelectHospitalModal: React.FC<SelectHospitalModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [hospitalName, setHospitalName] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (hospitalName.trim()) {
            onConfirm(hospitalName.trim());
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hospital-modal-title"
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md"
                onClick={e => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit}>
                    <h3 id="hospital-modal-title" className="text-lg font-bold mb-2 text-gray-900 dark:text-white">
                        Informar Hospital
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Por favor, insira o nome do hospital para todas as cirurgias que serão importadas desta imagem.
                    </p>
                    
                    <div>
                        <label htmlFor="hospitalName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Nome do Hospital</label>
                        <input 
                            type="text" 
                            id="hospitalName" 
                            value={hospitalName}
                            onChange={(e) => setHospitalName(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-600"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none"
                        >
                            Continuar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SelectHospitalModal;
