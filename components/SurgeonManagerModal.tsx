import React, { useState, useEffect } from 'react';
import { Surgeon, Anesthesiologist } from '../types';
import { db } from '../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

interface SurgeonManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    surgeons: Surgeon[];
    anesthesiologists: Anesthesiologist[];
}

const SurgeonManagerModal: React.FC<SurgeonManagerModalProps> = ({ isOpen, onClose, surgeons, anesthesiologists }) => {
    const [name, setName] = useState('');
    const [blockedIds, setBlockedIds] = useState<string[]>([]);
    const [editingSurgeonId, setEditingSurgeonId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setName('');
            setBlockedIds([]);
            setEditingSurgeonId(null);
        }
    }, [isOpen]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            if (editingSurgeonId) {
                const surgeonRef = doc(db, 'surgeons', editingSurgeonId);
                await updateDoc(surgeonRef, {
                    name: name.trim(),
                    blockedAnesthesiologistIds: blockedIds,
                });
            } else {
                const surgeonsRef = collection(db, 'surgeons');
                await addDoc(surgeonsRef, {
                    name: name.trim(),
                    blockedAnesthesiologistIds: blockedIds,
                });
            }
            setName('');
            setBlockedIds([]);
            setEditingSurgeonId(null);
        } catch (error) {
            console.error('Error saving surgeon:', error);
            alert('Erro ao salvar cirurgião.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (surgeon: Surgeon) => {
        setName(surgeon.name);
        setBlockedIds(surgeon.blockedAnesthesiologistIds || []);
        setEditingSurgeonId(surgeon.id);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este cirurgião?')) return;

        setIsLoading(true);
        try {
            const surgeonRef = doc(db, 'surgeons', id);
            await deleteDoc(surgeonRef);
        } catch (error) {
            console.error('Error deleting surgeon:', error);
            alert('Erro ao excluir cirurgião.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleBlocked = (anesthesiologistId: string) => {
        setBlockedIds(prev => 
            prev.includes(anesthesiologistId) 
                ? prev.filter(id => id !== anesthesiologistId) 
                : [...prev, anesthesiologistId]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gerenciar Cirurgiões</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSave} className="mb-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wider">
                        {editingSurgeonId ? 'Editar Cirurgião' : 'Novo Cirurgião'}
                    </h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Cirurgião</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Dr. João Silva"
                                className="w-full p-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anestesistas Bloqueados (Restrições)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                                {anesthesiologists.map(anes => (
                                    <label key={anes.id} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={blockedIds.includes(anes.id)}
                                            onChange={() => toggleBlocked(anes.id)}
                                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{anes.name}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Anestesistas marcados não aparecerão por padrão ao agendar para este cirurgião.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {editingSurgeonId ? 'Atualizar' : 'Cadastrar'}
                            </button>
                            {editingSurgeonId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingSurgeonId(null);
                                        setName('');
                                        setBlockedIds([]);
                                    }}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </div>
                </form>

                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Cirurgiões Cadastrados</h4>
                    {surgeons.length === 0 ? (
                        <p className="text-center py-8 text-gray-500 dark:text-gray-400 italic">Nenhum cirurgião cadastrado.</p>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            {surgeons.map(surgeon => (
                                <div key={surgeon.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <div>
                                        <h5 className="font-semibold text-gray-900 dark:text-white">{surgeon.name}</h5>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {surgeon.blockedAnesthesiologistIds?.length || 0} restrições
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(surgeon)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                            title="Editar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(surgeon.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                            title="Excluir"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SurgeonManagerModal;
