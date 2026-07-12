import { GoogleGenAI, Type } from "@google/genai";
import { Anesthesiologist, Surgery, TimePeriod, AvailabilityStatus, OnCallAssignment } from '../types';
import { WORKLOAD_DAYS } from '../constants';

// Fix: Add and export the ExtractedSurgeryData interface to resolve an import error.
export interface ExtractedSurgeryData {
    name: string;
    surgeon: string;
    startTime: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Calculate workload for the last N days for a specific anesthesiologist
const calculateWorkload = (anesthesiologistId: string, allSurgeries: Surgery[]): number => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - WORKLOAD_DAYS);

    return allSurgeries
        .filter(surgery =>
            surgery.anesthesiologistId === anesthesiologistId &&
            new Date(surgery.date) >= sevenDaysAgo && // Ensure date is a Date object
            new Date(surgery.date) < today // Exclude today's surgeries from past workload
        )
        .reduce((total, surgery) => total + surgery.estimatedTime, 0);
};

const getAvailabilityStatusForPeriod = (
    anesthesiologist: Anesthesiologist,
    period: TimePeriod,
    date: Date,
    weekendOnCallSchedule: { [date: string]: OnCallAssignment[] }
): AvailabilityStatus => {
    const dateString = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    const specificStatus = anesthesiologist.availability[dateString]?.[period];
    if (specificStatus) {
        return specificStatus;
    }

    let weekendStartDateStr: string | null = null;
    if (dayOfWeek === 5) {
        weekendStartDateStr = dateString;
    } else if (dayOfWeek === 6) {
        const friday = new Date(date.getTime() - (1 * 24 * 60 * 60 * 1000));
        weekendStartDateStr = friday.toISOString().split('T')[0];
    } else if (dayOfWeek === 0) {
        const friday = new Date(date.getTime() - (2 * 24 * 60 * 60 * 1000));
        weekendStartDateStr = friday.toISOString().split('T')[0];
    }

    if (weekendStartDateStr && weekendOnCallSchedule.hasOwnProperty(weekendStartDateStr)) {
        const isWithinOnCallPeriod = (
            (dayOfWeek === 5 && period === TimePeriod.Night) ||
            dayOfWeek === 6 ||
            dayOfWeek === 0
        );

        if (isWithinOnCallPeriod) {
            const isOnCall = weekendOnCallSchedule[weekendStartDateStr].some(a => a.id === anesthesiologist.id);
            return isOnCall ? AvailabilityStatus.Available : AvailabilityStatus.DayOff;
        }
    }

    const defaultStatus = anesthesiologist.defaultAvailability?.[dayOfWeek]?.[period];
    if (defaultStatus) {
        return defaultStatus;
    }

    return AvailabilityStatus.Available;
};

const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};


// Suggest a schedule with Gemini to balance workload
export const suggestScheduleWithGemini = async (
    unassignedSurgeries: Surgery[],
    availableAnesthesiologists: Anesthesiologist[],
    allSurgeries: Surgery[],
    selectedDate: Date,
    weekendOnCallSchedule: { [date: string]: OnCallAssignment[] }
): Promise<{ surgeryId: string, anesthesiologistId: string }[]> => {

    if (!unassignedSurgeries.length || !availableAnesthesiologists.length) {
        return [];
    }

    // --- PRE-PROCESSING: IDENTIFY AND GROUP SURGERY BLOCKS ---

    const condensableSurgeries: Surgery[] = [];
    unassignedSurgeries.forEach(surgery => {
        if (/endoscopia|colonoscopia/i.test(surgery.name) && surgery.startTime && surgery.hospital) {
            condensableSurgeries.push(surgery);
        }
    });
    
    const groupedByHospital = condensableSurgeries.reduce((acc, surgery) => {
        const key = surgery.hospital;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(surgery);
        return acc;
    }, {} as Record<string, Surgery[]>);
    
    const surgeryBlocks: { id: string; name: string; hospital: string; estimatedTime: number; startTime: string; originalSurgeryIds: string[] }[] = [];
    const processedIds = new Set<string>();

    for (const hospital in groupedByHospital) {
        const hospitalSurgeries = groupedByHospital[hospital].sort((a, b) => 
            a.startTime!.localeCompare(b.startTime!)
        );

        for (let i = 0; i < hospitalSurgeries.length; i++) {
            if (processedIds.has(hospitalSurgeries[i].id)) continue;
            
            const currentGroup: Surgery[] = [hospitalSurgeries[i]];
            
            for (let j = i + 1; j < hospitalSurgeries.length; j++) {
                if (processedIds.has(hospitalSurgeries[j].id)) continue;

                const prevSurgery = currentGroup[currentGroup.length - 1];
                const currentSurgery = hospitalSurgeries[j];
                
                const prevTime = timeToMinutes(prevSurgery.startTime!);
                const currentTime = timeToMinutes(currentSurgery.startTime!);
                
                const prevTypeMatch = prevSurgery.name.match(/endoscopia|colonoscopia/i);
                const currentTypeMatch = currentSurgery.name.match(/endoscopia|colonoscopia/i);
                const prevType = prevTypeMatch ? prevTypeMatch[0].toLowerCase() : null;
                const currentType = currentTypeMatch ? currentTypeMatch[0].toLowerCase() : null;

                if (prevType === currentType && (currentTime - prevTime) < 90) {
                    currentGroup.push(currentSurgery);
                } else {
                    break; 
                }
            }
            
            if (currentGroup.length > 1) {
                const totalEstimatedTime = currentGroup.reduce((sum, s) => sum + s.estimatedTime, 0);
                const firstSurgery = currentGroup[0];
                const blockId = `block-${firstSurgery.id}`;
                
                const procedureName = /endoscopia/i.test(firstSurgery.name) ? 'Endoscopia' : 'Colonoscopia';
                
                surgeryBlocks.push({
                    id: blockId,
                    name: `Bloco de ${procedureName} (${currentGroup.length}x)`,
                    hospital: firstSurgery.hospital,
                    estimatedTime: totalEstimatedTime,
                    startTime: firstSurgery.startTime!,
                    originalSurgeryIds: currentGroup.map(s => s.id)
                });
                
                currentGroup.forEach(s => processedIds.add(s.id));
            }
        }
    }
    
    const singleSurgeries = unassignedSurgeries.filter(s => !processedIds.has(s.id));
    
    const itemsForAI = [
        ...singleSurgeries.map(s => ({
            id: s.id,
            name: s.name,
            hospital: s.hospital,
            estimatedTime: s.estimatedTime,
            startTime: s.startTime,
        })),
        ...surgeryBlocks.map(b => ({
            id: b.id,
            name: b.name,
            hospital: b.hospital,
            estimatedTime: b.estimatedTime,
            startTime: b.startTime,
        }))
    ];

    // --- END PRE-PROCESSING ---

    const anesthesiologistsWithDetails = availableAnesthesiologists.map(a => ({
        id: a.id,
        name: a.name,
        workload: calculateWorkload(a.id, allSurgeries),
        isAvailableNight: getAvailabilityStatusForPeriod(a, TimePeriod.Night, selectedDate, weekendOnCallSchedule) === AvailabilityStatus.Available,
    }));

    const prompt = `
        Você é um assistente de agendamento inteligente para um departamento de anestesiologia.
        Sua tarefa é atribuir itens da agenda (cirurgias individuais ou blocos de procedimentos) a anestesistas disponíveis, seguindo regras de otimização.

        **Conceito Importante: "Bloco de Cirurgias"**
        - Alguns itens na lista são "Blocos". Um bloco representa múltiplos procedimentos sequenciais (ex: 3 colonoscopias) que DEVEM ser realizados pelo MESMO anestesista.
        - A ID de um bloco começará com "block-".
        - Você deve tratar um bloco como uma única unidade de trabalho indivisível. O tempo estimado para um bloco já é a soma de todos os procedimentos dentro dele.

        **Regras (em ordem ESTRITA de importância, da mais para a menos importante):**
        1.  **Disponibilidade Noturna:** Para cirurgias ou blocos que iniciam às 18:00 ou depois, dê FORTE PREFERÊNCIA aos anestesistas que estão disponíveis no período da noite ('isAvailableNight: true'). Evite escalar quem não está disponível à noite para essas cirurgias, a menos que seja a única opção para não deixar a cirurgia sem anestesista.
        2.  **Regra de Bloco e Continuidade:** Atribua um bloco inteiro a um único anestesista. NUNCA separe os procedimentos dentro de um bloco. É altamente preferível que o mesmo anestesista realize múltiplos procedimentos no mesmo hospital.
        3.  **Logística (Minimizar Deslocamento):** Evite ao máximo que um anestesista troque de hospital durante o dia. Manter um anestesista em um único hospital é muito mais importante do que balancear perfeitamente a carga de trabalho.
        4.  **Restrições de Horário:** Respeite o horário de início e a duração de cada item para evitar sobreposições de horário para um mesmo anestesista.
        5.  **Balanceamento de Carga (Menor Prioridade):** APÓS seguir TODAS as regras acima, tente distribuir o trabalho do dia da forma mais equilibrada possível, priorizando anestesistas com menor carga de trabalho recente.
        6.  **Completude:** Atribua TODOS os itens da lista.

        **Dados:**

        **Anestesistas Disponíveis (com carga de trabalho dos últimos ${WORKLOAD_DAYS} dias e disponibilidade noturna):**
        ${JSON.stringify(anesthesiologistsWithDetails, null, 2)}

        **Itens da Agenda para Hoje (Cirurgias e Blocos):**
        ${JSON.stringify(itemsForAI, null, 2)}

        **Sua Resposta:**
        Retorne APENAS um array JSON com os objetos de atribuição. Cada objeto deve ter 'surgeryId' (que pode ser a ID de uma cirurgia ou de um bloco) e 'anesthesiologistId'.
        Não inclua texto, explicações ou formatação de markdown.
    `;

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                surgeryId: { type: Type.STRING },
                anesthesiologistId: { type: Type.STRING },
            },
            required: ["surgeryId", "anesthesiologistId"],
        },
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const geminiAssignments = JSON.parse(jsonText);
        
        // --- POST-PROCESSING: EXPAND BLOCKS ---
        const finalAssignments: { surgeryId: string, anesthesiologistId: string }[] = [];

        geminiAssignments.forEach((assignment: { surgeryId: string, anesthesiologistId: string }) => {
            if (assignment.surgeryId.startsWith('block-')) {
                const originalBlock = surgeryBlocks.find(b => b.id === assignment.surgeryId);
                if (originalBlock) {
                    originalBlock.originalSurgeryIds.forEach((originalId: string) => {
                        finalAssignments.push({
                            surgeryId: originalId,
                            anesthesiologistId: assignment.anesthesiologistId
                        });
                    });
                }
            } else {
                finalAssignments.push(assignment);
            }
        });
        
        return finalAssignments;

    } catch (error) {
        console.error("Erro ao sugerir escala com o Gemini:", error);
        throw new Error("Falha ao obter sugestão da IA. Tente novamente.");
    }
};

const commonExtractionPrompt = `
    Sua tarefa é extrair informações de todas as cirurgias listadas no documento.
    Para cada linha que representa uma cirurgia individual, extraia os seguintes campos:
    1. 'startTime': O horário de início da cirurgia. Procure por uma coluna chamada "Hora" ou "Dt Agenda". Se a coluna contiver data e hora (ex: "04/11/2025 07:00"), extraia APENAS a parte da hora no formato "HH:MM". Se um horário claro não puder ser encontrado para uma linha, ignore-a.
    2. 'name': O nome do procedimento cirúrgico, encontrado na coluna "Procedimento".
    3. 'surgeon': O nome do cirurgião responsável, encontrado na coluna "Médico".

    REGRAS IMPORTANTES:
    - IGNORE A DATA. A data é irrelevante para esta tarefa.
    - IGNORE LINHAS QUE SÃO CABEÇALHOS, TOTAIS ou que não representam uma cirurgia (ex: "Total - SAMER - Sala 01 (3)").
    - Se uma linha não tiver um horário de início claro, um nome de procedimento e um nome de médico, ignore-a.
    - Retorne a resposta como um array de objetos JSON. A resposta deve ser APENAS o JSON, sem nenhum texto adicional, explicações ou formatação de markdown.
`;

const commonResponseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            startTime: { type: Type.STRING, description: "Horário de início no formato HH:MM" },
            name: { type: Type.STRING, description: "Nome do procedimento" },
            surgeon: { type: Type.STRING, description: "Nome do cirurgião" },
        },
        required: ["startTime", "name", "surgeon"],
    },
};

export const extractSurgeriesFromImage = async (base64Image: string, mimeType: string): Promise<ExtractedSurgeryData[]> => {
    const prompt = `Analise a imagem de uma grade cirúrgica. ${commonExtractionPrompt}`;

    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType: mimeType,
        },
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: commonResponseSchema,
            },
        });

        const jsonText = response.text.trim();
        const surgeries = JSON.parse(jsonText) as ExtractedSurgeryData[];
        return surgeries.sort((a, b) => a.startTime.localeCompare(b.startTime));
    } catch (error) {
        console.error("Erro ao extrair cirurgias da imagem com o Gemini:", error);
        throw new Error("Falha ao analisar a imagem. A IA não conseguiu processar os dados. Verifique se a imagem está nítida e tente novamente.");
    }
};

export const extractSurgeriesFromPdf = async (base64Pdf: string, mimeType: string): Promise<ExtractedSurgeryData[]> => {
    const prompt = `Analise este documento PDF que contém uma grade cirúrgica. ${commonExtractionPrompt}`;

    const pdfPart = {
        inlineData: {
            data: base64Pdf,
            mimeType: mimeType,
        },
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [pdfPart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: commonResponseSchema,
            },
        });

        const jsonText = response.text.trim();
        const surgeries = JSON.parse(jsonText) as ExtractedSurgeryData[];
        return surgeries.sort((a, b) => a.startTime.localeCompare(b.startTime));
    } catch (error) {
        console.error("Erro ao extrair cirurgias do PDF com o Gemini:", error);
        throw new Error("Falha ao analisar o PDF. A IA não conseguiu processar os dados. Verifique se o arquivo é válido e tente novamente.");
    }
};