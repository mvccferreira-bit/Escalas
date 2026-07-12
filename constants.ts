// Fix: Import types from the dedicated types.ts file.
import { Anesthesiologist, Surgery } from './types';

//
// ATENÇÃO: AÇÃO NECESSÁRIA!
//
// Para habilitar as funcionalidades de administrador (gerenciar permissões, editar
// escala anual de plantões), você precisa definir seu UID de usuário do Firebase aqui.
//
// Como encontrar seu UID:
// 1. Faça login no seu aplicativo normalmente.
// 2. Acesse o Console do Firebase: https://console.firebase.google.com/
// 3. Abra seu projeto.
// 4. No menu à esquerda, clique em "Authentication".
// 5. Na lista de usuários, encontre seu e-mail e copie o valor da coluna "User UID".
// 6. Cole o UID abaixo, substituindo 'REPLACE_WITH_YOUR_FIREBASE_UID'.
//
export const ADMIN_USER_UID = 'QcE4c65bgqUiDYRh6gqVZeLyWtx2';


// INSTRUÇÕES:
// Para editar a lista base de anestesistas da sua equipe,
// modifique a propriedade 'name' de cada um na lista abaixo.
// Você também pode adicionar ou remover anestesistas desta lista.
// O 'id' deve ser único para cada pessoa.
// A 'color' define a cor da coluna na visualização da escala.

export const getInitialAnesthesiologists = (): Anesthesiologist[] => {
    return [
        { 
            id: 'ane1', 
            name: 'Dr. João Silva', // <- Altere este nome
            color: 'bg-blue-200 dark:bg-blue-800', 
            availability: {},
            defaultAvailability: {}
        },
        { 
            id: 'ane2', 
            name: 'Dra. Maria Oliveira', // <- Altere este nome
            color: 'bg-green-200 dark:bg-green-800', 
            availability: {},
            defaultAvailability: {}
        },
        { 
            id: 'ane3', 
            name: 'Dr. Carlos Pereira', // <- Altere este nome
            color: 'bg-yellow-200 dark:bg-yellow-800', 
            availability: {},
            defaultAvailability: {}
        },
        { 
            id: 'ane4', 
            name: 'Dr. Pedro Martins', // <- Altere este nome
            color: 'bg-purple-200 dark:bg-purple-800', 
            availability: {},
            defaultAvailability: {}
        },
        { 
            id: 'ane5', 
            name: 'Dra. Ana Costa', // <- Altere este nome
            color: 'bg-pink-200 dark:bg-pink-800', 
            availability: {},
            defaultAvailability: {}
        },
    ];
};

export const getInitialSurgeries = (): Surgery[] => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(today.getDate() - 2);

    // Estes são dados de exemplo. Sinta-se à vontade para limpar esta lista para começar do zero.
    return [
        { id: 'surg1', name: 'Apendicectomia', surgeon: 'Dr. Souza', hospital: 'Hospital Central', estimatedTime: 60, date: today, anesthesiologistId: 'ane2' },
        { id: 'surg2', name: 'Prótese de Joelho', surgeon: 'Dr. Andrade', hospital: 'Clínica Ortopédica', estimatedTime: 120, date: today, anesthesiologistId: 'ane3' },
        { id: 'surg3', name: 'Colecistectomia', surgeon: 'Dr. Souza', hospital: 'Hospital Central', estimatedTime: 90, date: today, anesthesiologistId: null },
        { id: 'surg4', name: 'Revascularização do Miocárdio', surgeon: 'Dr. Gomes', hospital: 'Hospital do Coração', estimatedTime: 240, date: yesterday, anesthesiologistId: 'ane1' },
        { id: 'surg5', name: 'Prótese de Quadril', surgeon: 'Dr. Andrade', hospital: 'Clínica Ortopédica', estimatedTime: 150, date: yesterday, anesthesiologistId: 'ane2' },
        { id: 'surg6', name: 'Reparo de Hérnia', surgeon: 'Dr. Bastos', hospital: 'Hospital Geral', estimatedTime: 75, date: twoDaysAgo, anesthesiologistId: 'ane3' },
        { id: 'surg7', name: 'Cirurgia de Catarata', surgeon: 'Dr. Luz', hospital: 'Clínica Oftalmológica', estimatedTime: 30, date: twoDaysAgo, anesthesiologistId: 'ane5' },
    ];
};

export const WORKLOAD_DAYS = 7;
