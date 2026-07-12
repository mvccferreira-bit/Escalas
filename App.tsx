import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Anesthesiologist, Surgery, AvailabilityStatus, TimePeriod, DayPermissions, ExtraPeriod, AppUser, OnCallAssignment, OnCallRole, VacationSchedule, DefaultAvailability } from './types';
import { auth, db, Timestamp } from './services/firebase';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
// Fix: Use direct named imports for Firestore functions as required by the Firebase v9+ modular SDK.
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    where,
    getDocs,
    getDoc
} from 'firebase/firestore';
import Header from './components/Header';
import AvailabilityManager from './components/AvailabilityManager';
import SurgeryScheduler from './components/SurgeryScheduler';
import ScheduleView from './components/ScheduleView';
import Login from './components/Login';
import PermissionsModal from './components/PermissionsModal';
import SurgeonManagerModal from './components/SurgeonManagerModal';
import HeatmapView from './components/HeatmapView'; // Import the new component
import { suggestScheduleWithGemini } from './services/geminiService';
import { ADMIN_USER_UID } from './constants';
import { Surgeon } from './types';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [anesthesiologists, setAnesthesiologists] = useState<Anesthesiologist[]>([]);
    const [surgeries, setSurgeries] = useState<Surgery[]>([]);
    const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
    const [extraPeriods, setExtraPeriods] = useState<ExtraPeriod[]>([]);
    const [weekendOnCallSchedule, setWeekendOnCallSchedule] = useState<{ [date: string]: OnCallAssignment[] }>({});
    const [vacationSchedule, setVacationSchedule] = useState<VacationSchedule>({});
    const [permissions, setPermissions] = useState<{ [dayKey: string]: DayPermissions }>({});
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
    const [isSurgeonModalOpen, setIsSurgeonModalOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Ensure user document exists in 'users' collection, which is needed for linking anesthesiologists.
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (!userDocSnap.exists()) {
                    await setDoc(userDocRef, {
                        email: currentUser.email,
                        uid: currentUser.uid,
                    });
                }
            }
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const isAdmin = useMemo(() => user?.uid === ADMIN_USER_UID, [user]);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            setAnesthesiologists([]);
            setSurgeries([]);
            setSurgeons([]);
            setWeekendOnCallSchedule({});
            setVacationSchedule({});
            setPermissions({});
            setExtraPeriods([]);
            setAllUsers([]);
            return;
        };

        setIsLoading(true);
        
        const anesthesiologistsRef = collection(db, 'anesthesiologists');
        const qAnes = query(anesthesiologistsRef, orderBy('name'));
        const unsubscribeAnes = onSnapshot(qAnes, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Anesthesiologist[];
            setAnesthesiologists(data);
            setIsLoading(false);
        });

        const surgeonsRef = collection(db, 'surgeons');
        const qSurgeons = query(surgeonsRef, orderBy('name'));
        const unsubscribeSurgeons = onSnapshot(qSurgeons, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Surgeon[];
            setSurgeons(data);
        });

        const surgeriesRef = collection(db, 'surgeries');
        const unsubscribeSurgeries = onSnapshot(surgeriesRef, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const surgeryData = doc.data();
                return {
                    ...surgeryData,
                    id: doc.id,
                    date: (surgeryData.date as Timestamp).toDate(),
                }
            }) as Surgery[];
            setSurgeries(data);
        });

        const extraPeriodsRef = collection(db, 'extraPeriods');
        const unsubscribeExtraPeriods = onSnapshot(extraPeriodsRef, (snapshot) => {
             const data = snapshot.docs.map(doc => {
                const periodData = doc.data();
                return {
                    ...periodData,
                    id: doc.id,
                    createdAt: (periodData.createdAt as Timestamp).toDate(),
                }
            }) as ExtraPeriod[];
            setExtraPeriods(data);
        });
        
        const onCallDocRef = doc(db, 'schedules', 'weekendOnCall');
        const unsubscribeOnCall = onSnapshot(onCallDocRef, (doc) => {
            setWeekendOnCallSchedule(doc.data()?.schedule || {});
        });
        
        const vacationDocRef = doc(db, 'schedules', 'vacationSchedule');
        const unsubscribeVacations = onSnapshot(vacationDocRef, (doc) => {
            setVacationSchedule(doc.data()?.schedule || {});
        });

        const permissionsRef = collection(db, 'permissions');
        const unsubscribePermissions = onSnapshot(permissionsRef, (snapshot) => {
            const permsData: { [dayKey: string]: DayPermissions } = {};
            snapshot.forEach(doc => {
                permsData[doc.id] = doc.data() as DayPermissions;
            });
            setPermissions(permsData);
        });

        const usersRef = collection(db, 'users');
        const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
            const usersData = snapshot.docs.map(doc => doc.data() as AppUser);
            setAllUsers(usersData);
        });


        return () => {
            unsubscribeAnes();
            unsubscribeSurgeons();
            unsubscribeSurgeries();
            unsubscribeOnCall();
            unsubscribePermissions();
            unsubscribeExtraPeriods();
            unsubscribeUsers();
            unsubscribeVacations();
        };
    }, [user]);

    const { canEditAvailability, canEditSurgeries } = useMemo(() => {
        if (!user) return { canEditAvailability: false, canEditSurgeries: false };
        if (isAdmin) return { canEditAvailability: true, canEditSurgeries: true };

        const dayOfWeek = selectedDate.getDay();
        const dayKey = `day_${dayOfWeek}`;
        const permissionsForDay = permissions[dayKey];

        // Default policy: if no rules are set for the day, everyone can edit.
        if (!permissionsForDay || Object.keys(permissionsForDay).length === 0) {
            return { canEditAvailability: true, canEditSurgeries: true };
        }
        
        // If rules exist, check for the current user's specific permissions.
        // Default to false if the user is not explicitly listed.
        const userPermissions = permissionsForDay[user.uid];
        return {
            canEditAvailability: userPermissions?.canEditAvailability === true,
            canEditSurgeries: userPermissions?.canEditSurgeries === true,
        };
    }, [user, selectedDate, permissions, isAdmin]);
    
    const handleLogout = () => {
        signOut(auth).catch(error => console.error('Logout failed:', error));
    };

    const addAnesthesiologist = useCallback(async (email: string): Promise<void> => {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email.trim()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error(`Usuário com o e-mail '${email}' não encontrado no sistema.`);
        }
        const userDoc = querySnapshot.docs[0];
        const appUser = userDoc.data() as AppUser;

        const alreadyExists = anesthesiologists.some(a => a.uid === appUser.uid);
        if (alreadyExists) {
            throw new Error('Este usuário já foi adicionado como anestesista.');
        }

        const colors = ['bg-blue-200 dark:bg-blue-800', 'bg-green-200 dark:bg-green-800', 'bg-yellow-200 dark:bg-yellow-800', 'bg-purple-200 dark:bg-purple-800', 'bg-pink-200 dark:bg-pink-800', 'bg-indigo-200 dark:bg-indigo-800', 'bg-red-200 dark:bg-red-800'];
        const newAnesthesiologist = {
            name: appUser.email || 'Nome não definido',
            uid: appUser.uid,
            color: colors[anesthesiologists.length % colors.length],
            availability: {},
            defaultAvailability: {},
        };
        await addDoc(collection(db, 'anesthesiologists'), newAnesthesiologist);
    }, [anesthesiologists]);

    const updateAnesthesiologist = useCallback(async (id: string, updates: { name: string; emailToLink: string | null }) => {
        const { name, emailToLink } = updates;
        const docRef = doc(db, 'anesthesiologists', id);
        const dataToUpdate: { name: string; uid?: string | null } = { name };
    
        if (emailToLink) {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', emailToLink.trim()));
            const querySnapshot = await getDocs(q);
    
            if (querySnapshot.empty) {
                throw new Error(`Nenhum usuário encontrado com o e-mail: ${emailToLink}`);
            }
            const userDoc = querySnapshot.docs[0];
            dataToUpdate.uid = userDoc.data().uid;
        } else {
            // Set uid to null to unlink
            dataToUpdate.uid = null;
        }
    
        await updateDoc(docRef, dataToUpdate);
    }, []);

    const deleteAnesthesiologist = useCallback(async (id: string) => {
        const surgeriesToUpdate = surgeries.filter(s => s.anesthesiologistId === id);
        await Promise.all(surgeriesToUpdate.map(surgery => {
            const surgDocRef = doc(db, 'surgeries', surgery.id);
            return updateDoc(surgDocRef, { anesthesiologistId: null });
        }));
        
        const newSchedule = { ...weekendOnCallSchedule };
        let scheduleChanged = false;
        Object.keys(newSchedule).forEach(key => {
            const initialLength = newSchedule[key].length;
            newSchedule[key] = newSchedule[key].filter((assignment: OnCallAssignment) => assignment.id !== id);
             if (initialLength !== newSchedule[key].length) scheduleChanged = true;
            if (newSchedule[key].length === 0) {
                delete newSchedule[key];
            }
        });

        if(scheduleChanged) {
            const scheduleDocRef = doc(db, 'schedules', 'weekendOnCall');
            await setDoc(scheduleDocRef, { schedule: newSchedule });
        }
        
        await deleteDoc(doc(db, 'anesthesiologists', id));
    }, [surgeries, weekendOnCallSchedule]);
    
    const updateAnesthesiologistAvailability = useCallback(async (id: string, date: Date, period: TimePeriod, status: AvailabilityStatus) => {
        const anesthesiologist = anesthesiologists.find(a => a.id === id);
        if (!anesthesiologist) return;

        const dateString = date.toISOString().split('T')[0];
        const newAvailability = JSON.parse(JSON.stringify(anesthesiologist.availability || {}));
        
        if (!newAvailability[dateString]) newAvailability[dateString] = {};

        const dayOfWeek = date.getDay();
        const defaultStatus = anesthesiologist.defaultAvailability?.[dayOfWeek]?.[period];

        if (status === AvailabilityStatus.Available) {
            if (defaultStatus && defaultStatus !== AvailabilityStatus.Available) {
                 newAvailability[dateString][period] = status;
            } else {
                delete newAvailability[dateString][period];
                if (Object.keys(newAvailability[dateString]).length === 0) {
                    delete newAvailability[dateString];
                }
            }
        } else {
            newAvailability[dateString][period] = status;
        }
        
        await updateDoc(doc(db, 'anesthesiologists', id), { availability: newAvailability });
    }, [anesthesiologists]);

    // Fix: Replaced saveAnesthesiologistDefaultAvailability with a function that matches the signature expected by AvailabilityManager.
    const updateAnesthesiologistDefaultAvailability = useCallback(async (id: string, dayOfWeek: number, period: TimePeriod, status: AvailabilityStatus) => {
        const anesthesiologist = anesthesiologists.find(a => a.id === id);
        if (!anesthesiologist) return;

        const newDefaultAvailability = JSON.parse(JSON.stringify(anesthesiologist.defaultAvailability || {}));

        if (!newDefaultAvailability[dayOfWeek]) {
            newDefaultAvailability[dayOfWeek] = {};
        }

        if (status === AvailabilityStatus.Available) {
            delete newDefaultAvailability[dayOfWeek][period];
            if (Object.keys(newDefaultAvailability[dayOfWeek]).length === 0) {
                delete newDefaultAvailability[dayOfWeek];
            }
        } else {
            newDefaultAvailability[dayOfWeek][period] = status;
        }

        await updateDoc(doc(db, 'anesthesiologists', id), { defaultAvailability: newDefaultAvailability });
    }, [anesthesiologists]);

    // Fix: Added updateWeekendOnCall to handle incremental updates from the OnCallCalendarModal.
    const updateWeekendOnCall = useCallback(async (weekendStartDate: string, anesthesiologistId: string, role: OnCallRole | null) => {
        const newSchedule = JSON.parse(JSON.stringify(weekendOnCallSchedule));
        
        if (!newSchedule[weekendStartDate]) {
            newSchedule[weekendStartDate] = [];
        }
        
        newSchedule[weekendStartDate] = newSchedule[weekendStartDate].filter((a: OnCallAssignment) => a.id !== anesthesiologistId);

        if (role) {
            newSchedule[weekendStartDate].push({ id: anesthesiologistId, role });
        }

        if (newSchedule[weekendStartDate].length === 0) {
            delete newSchedule[weekendStartDate];
        }

        const scheduleDocRef = doc(db, 'schedules', 'weekendOnCall');
        await setDoc(scheduleDocRef, { schedule: newSchedule });
    }, [weekendOnCallSchedule]);
    
    // Fix: Added updateVacationSchedule to handle incremental updates from the VacationCalendarModal.
    const updateVacationSchedule = useCallback(async (weekStartDate: string, anesthesiologistId: string, isOnVacation: boolean) => {
        const newSchedule = JSON.parse(JSON.stringify(vacationSchedule));

        if (!newSchedule[weekStartDate]) {
            newSchedule[weekStartDate] = [];
        }

        const isAlreadyOnVacation = newSchedule[weekStartDate].includes(anesthesiologistId);

        if (isOnVacation && !isAlreadyOnVacation) {
            newSchedule[weekStartDate].push(anesthesiologistId);
        } else if (!isOnVacation && isAlreadyOnVacation) {
            newSchedule[weekStartDate] = newSchedule[weekStartDate].filter((id: string) => id !== anesthesiologistId);
        }

        if (newSchedule[weekStartDate].length === 0) {
            delete newSchedule[weekStartDate];
        }
        
        const scheduleDocRef = doc(db, 'schedules', 'vacationSchedule');
        await setDoc(scheduleDocRef, { schedule: newSchedule });
    }, [vacationSchedule]);


    const addSurgery = useCallback(async (newSurgery: Omit<Surgery, 'id'>) => {
        await addDoc(collection(db, 'surgeries'), {
            ...newSurgery,
            date: Timestamp.fromDate(newSurgery.date)
        });
    }, []);

    const updateSurgery = useCallback(async (updatedSurgery: Surgery) => {
        const docRef = doc(db, 'surgeries', updatedSurgery.id);
        const { id, ...dataToUpdate } = updatedSurgery;
        await updateDoc(docRef, {
            ...dataToUpdate,
            date: Timestamp.fromDate(dataToUpdate.date)
        });
    }, []);
    
    const deleteSurgery = useCallback(async (surgeryId: string) => {
        await deleteDoc(doc(db, 'surgeries', surgeryId));
    }, []);

    const addExtraPeriod = useCallback(async (anesthesiologistId: string, date: Date, period: TimePeriod) => {
        if (!user) throw new Error("Usuário não autenticado.");
        const newExtraPeriod = {
            anesthesiologistId,
            date: date.toISOString().split('T')[0],
            period,
            addedBy: user.uid,
            createdAt: Timestamp.now()
        };
        await addDoc(collection(db, 'extraPeriods'), newExtraPeriod);
    }, [user]);

    const deleteExtraPeriod = useCallback(async (periodId: string) => {
        await deleteDoc(doc(db, 'extraPeriods', periodId));
    }, []);

    const updatePermissions = useCallback(async (dayKey: string, uid: string, updates: { canEditAvailability: boolean; canEditSurgeries: boolean }) => {
        const docRef = doc(db, 'permissions', dayKey);
        const currentDayPermissions = permissions[dayKey] || {};
        const newDayPermissions = {
            ...currentDayPermissions,
            [uid]: updates
        };
        await setDoc(docRef, newDayPermissions);
    }, [permissions]);


    const availableAnesthesiologists = useMemo(() => {
        const dateString = selectedDate.toISOString().split('T')[0];
        const dayOfWeek = selectedDate.getDay();

        return anesthesiologists.filter(a => {
            // Vacation check (highest priority, Mon-Fri only)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const dateCopy = new Date(selectedDate.getTime());
                // Go back to Monday of the current week
                dateCopy.setDate(selectedDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                const weekStartDateStr = dateCopy.toISOString().split('T')[0];

                if (vacationSchedule[weekStartDateStr]?.includes(a.id)) {
                    return false; // On vacation, not available.
                }
            }

            const dailyOverride = a.availability?.[dateString];
            const weeklyDefault = a.defaultAvailability?.[dayOfWeek];
            const getStatus = (period: TimePeriod) => dailyOverride?.[period] ?? weeklyDefault?.[period] ?? AvailabilityStatus.Available;
            const isUnavailableMorning = getStatus(TimePeriod.Morning) !== AvailabilityStatus.Available;
            const isUnavailableAfternoon = getStatus(TimePeriod.Afternoon) !== AvailabilityStatus.Available;
            const isUnavailableNight = getStatus(TimePeriod.Night) !== AvailabilityStatus.Available;
            return !(isUnavailableMorning && isUnavailableAfternoon && isUnavailableNight);
        });
    }, [anesthesiologists, selectedDate, vacationSchedule]);
    
    const dailySurgeries = useMemo(() => {
       return surgeries.filter(s => s.date.toDateString() === selectedDate.toDateString());
    }, [surgeries, selectedDate]);

    const handleSuggestSchedule = useCallback(async () => {
        const unassignedSurgeries = dailySurgeries.filter(s => !s.anesthesiologistId);
        if (unassignedSurgeries.length === 0) {
            alert("Não há cirurgias não atribuídas para agendar.");
            return;
        }

        setIsSuggesting(true);
        try {
            const suggestedAssignments = await suggestScheduleWithGemini(unassignedSurgeries, availableAnesthesiologists, surgeries, selectedDate, weekendOnCallSchedule);

            await Promise.all(suggestedAssignments.map(assignment => {
                const surgeryToUpdate = surgeries.find(s => s.id === assignment.surgeryId);
                if (surgeryToUpdate) {
                    return updateSurgery({ ...surgeryToUpdate, anesthesiologistId: assignment.anesthesiologistId });
                }
                return Promise.resolve();
            }));

        } catch (error) {
            console.error("Failed to get schedule suggestion:", error);
            alert((error as Error).message || "Ocorreu um erro ao gerar a sugestão. Verifique o console para mais detalhes.");
        } finally {
            setIsSuggesting(false);
        }
    }, [dailySurgeries, availableAnesthesiologists, surgeries, updateSurgery, selectedDate, weekendOnCallSchedule]);
    
    if (authLoading) {
        return <div className="flex justify-center items-center min-h-screen text-xl dark:text-white">Carregando...</div>;
    }
    
    if (!user) {
        return <Login />;
    }

    return (
        <div className="min-h-screen text-gray-800 dark:text-gray-200">
            <Header 
                user={user} 
                onLogout={handleLogout} 
                onManagePermissions={() => setIsPermissionsModalOpen(true)}
                onManageSurgeons={() => setIsSurgeonModalOpen(true)}
                isAdmin={isAdmin}
            />
            {isAdmin && isPermissionsModalOpen && (
                <PermissionsModal 
                    isOpen={isPermissionsModalOpen}
                    onClose={() => setIsPermissionsModalOpen(false)}
                    allUsers={allUsers}
                    permissions={permissions}
                    onUpdatePermissions={updatePermissions}
                />
            )}
            {isAdmin && isSurgeonModalOpen && (
                <SurgeonManagerModal
                    isOpen={isSurgeonModalOpen}
                    onClose={() => setIsSurgeonModalOpen(false)}
                    surgeons={surgeons}
                    anesthesiologists={anesthesiologists}
                />
            )}
            {isLoading ? (
                <div className="flex justify-center items-center p-8 text-xl dark:text-white">Sincronizando dados...</div>
            ) : (
            <main className="p-4 sm:p-6 lg:p-8 space-y-8">
                <AvailabilityManager
                    anesthesiologists={anesthesiologists}
                    user={user}
                    updateAvailability={updateAnesthesiologistAvailability}
                    // Fix: Renamed prop and passed the correct handler function.
                    updateDefaultAvailability={updateAnesthesiologistDefaultAvailability}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    addAnesthesiologist={addAnesthesiologist}
                    updateAnesthesiologist={updateAnesthesiologist}
                    deleteAnesthesiologist={deleteAnesthesiologist}
                    weekendOnCallSchedule={weekendOnCallSchedule}
                    // Fix: Renamed prop and passed the correct handler function.
                    updateWeekendOnCall={updateWeekendOnCall}
                    vacationSchedule={vacationSchedule}
                    // Fix: Renamed prop and passed the correct handler function.
                    updateVacationSchedule={updateVacationSchedule}
                    extraPeriods={extraPeriods}
                    addExtraPeriod={addExtraPeriod}
                    deleteExtraPeriod={deleteExtraPeriod}
                    isReadOnly={!canEditAvailability}
                    isAdmin={isAdmin}
                    allUsers={allUsers}
                />
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <SurgeryScheduler
                            addSurgery={addSurgery}
                            availableAnesthesiologists={anesthesiologists}
                            selectedDate={selectedDate}
                            setSelectedDate={setSelectedDate}
                            dailySurgeries={dailySurgeries}
                            onSuggestSchedule={handleSuggestSchedule}
                            hasUnassignedSurgeries={dailySurgeries.some(s => !s.anesthesiologistId)}
                            isSuggesting={isSuggesting}
                            isReadOnly={!canEditSurgeries}
                            weekendOnCallSchedule={weekendOnCallSchedule}
                            vacationSchedule={vacationSchedule}
                            surgeons={surgeons}
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <ScheduleView
                            dailySurgeries={dailySurgeries}
                            allSurgeries={surgeries}
                            anesthesiologists={anesthesiologists}
                            updateSurgery={updateSurgery}
                            deleteSurgery={deleteSurgery}
                            selectedDate={selectedDate}
                            weekendOnCallSchedule={weekendOnCallSchedule}
                            vacationSchedule={vacationSchedule}
                            isReadOnly={!canEditSurgeries}
                            surgeons={surgeons}
                        />
                    </div>
                </div>
                <HeatmapView surgeries={surgeries} selectedDate={selectedDate} />
            </main>
            )}
        </div>
    );
};

// Fix: Add default export to resolve import error in index.tsx
export default App;