import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { AppUser, DayPermissions } from '../types';

interface PermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPermissions: { [dayKey: string]: DayPermissions };
}

const PermissionsModal: React.FC<PermissionsModalProps> = ({ isOpen, onClose, initialPermissions }) => {
    const [permissions, setPermissions] = useState(initialPermissions);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [selectedDay, setSelectedDay] = useState('day_1'); // Default to Monday
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setPermissions(initialPermissions);
    }, [initialPermissions]);

    const daysOfWeek = [
        { key: 'day_1', name: 'Segunda-feira' },
        { key: 'day_2', name: 'Terça-feira' },
        { key: 'day_3', name: 'Quarta-feira' },
        { key: 'day_4', name: 'Quinta-feira' },
        { key: 'day_5', name: 'Sexta-feira' },
        { key: 'day_6', name: 'Sábado' },
        { key: 'day_0', name: 'Domingo' },
    ];

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newUserEmail.trim()) {
            setError('Por favor, insira um e-mail.');
            return;
        }
        setIsLoading(true);

        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', newUserEmail.trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError(`Usuário com o e-mail '${newUserEmail}' não encontrado.`);
                setIsLoading(false);
                return;
            }

            const userDoc = querySnapshot.docs[0];
            const user = userDoc.data() as AppUser;

            const dayPermissions = permissions[selectedDay] || {};
            if (dayPermissions[user.uid]) {
                setError('Este usuário já foi adicionado para este dia.');
                setIsLoading(false);
                return;
            }

            const updatedPermissions = {
                ...permissions,
                [selectedDay]: {
                    ...dayPermissions,
                    [user.uid]: {
                        email: user.email,
                        canEditAvailability: true,
                        canEditSurgeries: true,
                    },
                },
            };
            await savePermissions(selectedDay, updatedPermissions[selectedDay]);
            setPermissions(updatedPermissions);
            setNewUserEmail('');
        } catch (err) {
            console.error("Erro ao adicionar usuário:", err);
            setError('Ocorreu um erro ao buscar o usuário.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePermissionChange = async (dayKey: string, userId: string, permType: 'canEditAvailability' | 'canEditSurgeries', value: boolean) => {
        const updatedDayPermissions = { ...permissions[dayKey] };
        updatedDayPermissions[userId] = { ...updatedDayPermissions[userId], [permType]: value };
        const updatedPermissions = { ...permissions, [dayKey]: updatedDayPermissions };
        setPermissions(updatedPermissions);
        await savePermissions(dayKey, updatedPermissions[dayKey]);
    };
    
    const handleRemoveUser = async (dayKey: string, userId: string) => {
        const updatedDayPermissions = { ...permissions[dayKey] };
        delete updatedDayPermissions[userId];
        const updatedPermissions = { ...permissions, [dayKey]: updatedDayPermissions };
        setPermissions(updatedPermissions);
        await savePermissions(dayKey, updatedPermissions[dayKey]);
    };

    const savePermissions = async (dayKey: string, dayData: DayPermissions) => {
        const docRef = doc(db, 'permissions', dayKey);
        try {
            await setDoc(docRef, dayData);
        } catch (err) {
            console.error("Erro ao salvar permissões:", err);
            setError("Falha ao salvar. Tente novamente.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gerenciar Permissões de Edição</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Defina quais usuários podem editar a disponibilidade e as cirurgias em cada dia da semana.
                    </p>
                </header>

                <main className="p-6 overflow-y-auto flex-grow">
                    <div className="mb-6 p-4 border rounded-lg dark:border-gray-600">
                        <h4 className="font-semibold mb-2 dark:text-white">Adicionar Editor</h4>
                        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row items-start gap-4">
                             <div className="w-full sm:w-1/3">
                                <label htmlFor="dayOfWeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dia da Semana</label>
                                <select id="dayOfWeek" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    {daysOfWeek.map(day => <option key={day.key} value={day.key}>{day.name}</option>)}
                                </select>
                            </div>
                            <div className="w-full sm:w-2/3">
                                <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">E-mail do Usuário</label>
                                <div className="flex gap-2">
                                     <input type="email" id="userEmail" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="email@exemplo.com" className="mt-1 flex-grow w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                     <button type="submit" disabled={isLoading} className="mt-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                                        {isLoading ? '...' : 'Adicionar'}
                                     </button>
                                </div>
                            </div>
                        </form>
                         {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    </div>

                    <div className="space-y-6">
                        {daysOfWeek.map(day => (
                            <div key={day.key}>
                                <h4 className="font-bold text-lg mb-2 dark:text-white">{day.name}</h4>
                                <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                        <tr>
                                            <th className="px-4 py-2">Usuário</th>
                                            <th className="px-4 py-2 text-center">Editar Disponibilidade</th>
                                            <th className="px-4 py-2 text-center">Editar Cirurgias</th>
                                            <th className="px-4 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {permissions[day.key] && Object.keys(permissions[day.key]).length > 0 ? (
                                            Object.entries(permissions[day.key]).map(([userId, userPermsData]) => {
                                                // Fix: Cast userPermsData to the correct type. `Object.entries` on an object 
                                                // with an index signature can result in values of type `unknown`.
                                                const userPerms = userPermsData as DayPermissions[string];
                                                return (
                                                <tr key={userId} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{userPerms.email}</td>
                                                    <td className="px-4 py-2 text-center">
                                                        <input type="checkbox" checked={!!userPerms.canEditAvailability} onChange={e => handlePermissionChange(day.key, userId, 'canEditAvailability', e.target.checked)} className="w-4 h-4 text-blue-600 bg-gray-100 rounded border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600"/>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                         <input type="checkbox" checked={!!userPerms.canEditSurgeries} onChange={e => handlePermissionChange(day.key, userId, 'canEditSurgeries', e.target.checked)} className="w-4 h-4 text-blue-600 bg-gray-100 rounded border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600"/>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button onClick={() => handleRemoveUser(day.key, userId)} className="text-red-500 hover:text-red-700">Excluir</button>
                                                    </td>
                                                </tr>
                                                );
                                            })
                                        ) : (
                                            <tr className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                                <td colSpan={4} className="px-4 py-3 text-center text-gray-500 italic">Nenhum editor definido. Todos os usuários podem editar.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        ))}
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

export default PermissionsModal;