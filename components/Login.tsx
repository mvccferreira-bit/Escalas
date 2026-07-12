import React, { useState } from 'react';
import { auth, db } from '../services/firebase';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    AuthError
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const EyeSlashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.673.124 2.468.352M10.582 10.582a3 3 0 112.828 2.828M18 18L6 6" />
    </svg>
);


const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isResetMode, setIsResetMode] = useState(false);

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!email || !password) {
            setError('Por favor, preencha e-mail e senha.');
            return;
        }

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Save user info to 'users' collection for permission management
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    email: userCredential.user.email,
                    uid: userCredential.user.uid,
                });
            }
        } catch (err) {
            const authError = err as AuthError;
            console.error(authError);
            switch (authError.code) {
                case 'auth/invalid-email':
                    setError('O formato do e-mail é inválido.');
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setError('E-mail ou senha incorretos.');
                    break;
                case 'auth/email-already-in-use':
                    setError('Este e-mail já está cadastrado.');
                    break;
                case 'auth/weak-password':
                    setError('A senha deve ter no mínimo 6 caracteres.');
                    break;
                default:
                    setError('Ocorreu um erro. Tente novamente.');
                    break;
            }
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!email) {
            setError('Por favor, digite seu e-mail para redefinir a senha.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('Um link para redefinir sua senha foi enviado para o seu e-mail.');
        } catch (err) {
            const authError = err as AuthError;
            console.error(authError);
            switch (authError.code) {
                case 'auth/invalid-email':
                    setError('O formato do e-mail é inválido.');
                    break;
                case 'auth/user-not-found':
                    setError('Nenhuma conta encontrada com este e-mail.');
                    break;
                default:
                    setError('Ocorreu um erro ao tentar enviar o e-mail. Tente novamente.');
                    break;
            }
        }
    };

    if (isResetMode) {
        return (
             <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Redefinir Senha</h1>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Digite seu e-mail para receber um link de redefinição.
                        </p>
                    </div>
                    <form className="space-y-6" onSubmit={handlePasswordReset}>
                        <div>
                            <label htmlFor="email" className="text-sm font-bold text-gray-600 dark:text-gray-300 block">E-mail</label>
                            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                        </div>
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        {message && <p className="text-green-500 text-sm text-center">{message}</p>}
                        <div>
                            <button type="submit" className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-md text-white text-sm">
                                Enviar Link de Redefinição
                            </button>
                        </div>
                    </form>
                    <div className="text-center">
                        <button onClick={() => { setIsResetMode(false); setError(''); setMessage(''); }} className="text-sm text-blue-500 hover:underline">
                            Voltar para o login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Gestor de Escalas GAP
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {isLogin ? 'Faça login para continuar' : 'Crie sua conta para começar'}
                    </p>
                </div>
                <form className="space-y-4" onSubmit={handleAuthAction}>
                    <div>
                        <label htmlFor="email" className="text-sm font-bold text-gray-600 dark:text-gray-300 block">E-mail</label>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                    </div>
                    <div>
                        <label htmlFor="password" className="text-sm font-bold text-gray-600 dark:text-gray-300 block">Senha</label>
                        <div className="relative">
                            <input
                                id="password"
                                type={isPasswordVisible ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded mt-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white pr-10"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                aria-label={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                                {isPasswordVisible ? <EyeSlashIcon /> : <EyeIcon />}
                            </button>
                        </div>
                    </div>
                     <div className="text-right">
                        <button
                            type="button"
                            onClick={() => { setIsResetMode(true); setError(''); setMessage(''); }}
                            className="text-xs text-blue-500 hover:underline font-medium"
                        >
                            Esqueceu a senha?
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <div>
                        <button type="submit" className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-md text-white text-sm">
                            {isLogin ? 'Entrar' : 'Cadastrar'}
                        </button>
                    </div>
                </form>
                <div className="text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                            setMessage('');
                        }}
                        className="text-sm text-blue-500 hover:underline"
                    >
                        {isLogin
                            ? 'Não tem uma conta? Cadastre-se'
                            : 'Já tem uma conta? Faça login'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;