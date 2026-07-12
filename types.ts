// Fix: Centralize all type definitions here and export them.
// This resolves circular dependencies and "not exported" errors across the app.

export enum TimePeriod {
    Morning = 'Manhã',
    Afternoon = 'Tarde',
    Night = 'Noite',
}

export enum AvailabilityStatus {
    Available = 'Disponível',
    DayOff = 'Folga',
    Vacation = 'Férias',
    Leave = 'Afastado',
}

export enum OnCallRole {
    P1S = 'P1S', // Plantão 1 Sala
    P2S = 'P2S', // Plantão 2 Salas
    P1U = 'P1U', // Plantão 1 Urgência
    P2U = 'P2U', // Plantão 2 Urgência
}

export interface Availability {
    [date: string]: {
        [key in TimePeriod]?: AvailabilityStatus;
    };
}

export interface DefaultAvailability {
    [dayOfWeek: number]: {
        [key in TimePeriod]?: AvailabilityStatus;
    };
}

export interface Anesthesiologist {
    id: string;
    name: string;
    uid?: string | null;
    color: string;
    availability: Availability;
    defaultAvailability: DefaultAvailability;
}

export interface Surgeon {
    id: string;
    name: string;
    blockedAnesthesiologistIds: string[];
}

export interface Surgery {
    id: string;
    name: string;
    surgeon: string; // This can be the surgeon's name or ID. Let's keep it as string for compatibility but we'll use surgeonId if available.
    surgeonId?: string; 
    hospital: string;
    estimatedTime: number; // in minutes
    date: Date;
    anesthesiologistId: string | null;
    secondAnesthesiologistId?: string | null;
    startTime?: string;
}

export interface ExtraPeriod {
    id: string;
    anesthesiologistId: string;
    date: string; // YYYY-MM-DD
    period: TimePeriod;
    addedBy: string; // user uid
    createdAt: Date;
}

export interface AppUser {
    uid: string;
    email: string;
}

export interface OnCallAssignment {
    id: string; // anesthesiologistId
    role: OnCallRole;
}

export interface VacationSchedule {
    [weekStartDate: string]: string[]; // array of anesthesiologist IDs
}

export interface DayPermissions {
    [userId: string]: {
        email: string;
        canEditAvailability: boolean;
        canEditSurgeries: boolean;
    };
}