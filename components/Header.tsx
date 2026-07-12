import React from 'react';
import { User } from 'firebase/auth';

interface HeaderProps {
    user: User | null;
    onLogout: () => void;
    onManagePermissions: () => void;
    onManageSurgeons: () => void;
    isAdmin: boolean;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onManagePermissions, onManageSurgeons, isAdmin }) => {
    return (
        <header className="bg-white dark:bg-gray-800 shadow-md">
            <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 dark:text-blue-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Gestor de Escalas GAP
                    </h1>
                </div>
                {user && (
                     <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-sm text-gray-600 dark:text-gray-300 hidden md:block">{user.email}</span>
                        {isAdmin && (
                            <div className="flex gap-1">
                                <button
                                    onClick={onManageSurgeons}
                                    title="Gerenciar Cirurgiões"
                                    className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                    aria-label="Gerenciar Cirurgiões"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={onManagePermissions}
                                    title="Gerenciar Permissões"
                                    className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                    aria-label="Gerenciar Permissões"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        )}
                        <button 
                            onClick={onLogout}
                            className="text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-4 py-2"
                        >
                            Sair
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;