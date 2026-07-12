import React, { useState, useEffect } from 'react';
import { Anesthesiologist, AppUser } from '../types';

interface EditAnesthesiologistModalProps {
    isOpen: boolean;
    onClose: () => void;
    anesthesiologist: Anesthesiologist | null;
    onSave: (id: string, updates: { name: string; emailToLink: string | null }) => Promise<void>;
    allUsers: AppUser[];
}

const EditAnesthesiologistModal: React.FC<EditAnesthesiologistModalProps> = ({ isOpen, onClose, anesthesiologist, onSave, allUsers }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (anesthesiologist) {
            setName(anesthesiologist.name);
            const linkedUser = allUsers.find(u => u.uid === anesthesiologist.uid);
            setEmail(linkedUser?.email || '');
            setError('');
        }
    }, [anesthesiologist, allUsers]);

    if (!isOpen || !anesthesiologist) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) {
            setError('O nome não pode ficar em branco.');
            return;
        }
        setIsLoading(true);
        try {
            await onSave(anesthesiologist.id, { name: name.trim(), emailToLink: email.trim() || null });
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Editar Anestesista</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="anesName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Nome de Exibição</label>
                        <input
                            id="anesName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="anesEmail" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">Vincular Usuário (por E-mail)</label>
                        <input
                            id="anesEmail"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Deixe em branco para desvincular"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Vincular um usuário permite que ele acesse a plataforma e gerencie suas próprias disponibilidades (conforme as permissões do dia). O e-mail deve corresponder a uma conta de usuário já cadastrada.
                        </p>
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    
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
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none disabled:bg-blue-400"
                        >
                            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditAnesthesiologistModal;
