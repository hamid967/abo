import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type WorkspaceTask = { id: string; title: string; description?: string; priority: "low" | "normal" | "high" | "urgent"; status: "new" | "in_progress" | "awaiting_customer" | "completed" | "overdue"; dueDate?: string; transactionId?: string; };
export type WorkspaceAppointment = { id: string; title: string; location?: string; startsAt: string; status: "scheduled" | "completed" | "cancelled"; transactionId?: string; };
export type WorkspaceDocument = { id: string; name: string; mimeType?: string; size?: number; uri: string; addedAt: string; transactionId?: string; verificationStatus: "pending" | "verified" | "rejected"; };

type WorkspaceContextValue = {
  isLoading: boolean;
  tasks: WorkspaceTask[];
  appointments: WorkspaceAppointment[];
  documents: WorkspaceDocument[];
  addTask: (task: Omit<WorkspaceTask, "id">) => Promise<void>;
  updateTaskStatus: (id: string, status: WorkspaceTask["status"]) => Promise<void>;
  addAppointment: (appointment: Omit<WorkspaceAppointment, "id">) => Promise<void>;
  addDocument: (document: Omit<WorkspaceDocument, "id" | "addedAt" | "verificationStatus">) => Promise<void>;
};

const STORAGE_KEY = "abu-mishal-workspace:v1";
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [appointments, setAppointments] = useState<WorkspaceAppointment[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback(async (next: { tasks: WorkspaceTask[]; appointments: WorkspaceAppointment[]; documents: WorkspaceDocument[] }) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)), []);

  useEffect(() => { void (async () => { try { const raw = await AsyncStorage.getItem(STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw) as Partial<{ tasks: WorkspaceTask[]; appointments: WorkspaceAppointment[]; documents: WorkspaceDocument[] }>; setTasks(parsed.tasks ?? []); setAppointments(parsed.appointments ?? []); setDocuments(parsed.documents ?? []); } } finally { setIsLoading(false); } })(); }, []);

  const addTask = useCallback(async (task: Omit<WorkspaceTask, "id">) => { const nextTasks = [{ ...task, id: `task-${Date.now()}` }, ...tasks]; setTasks(nextTasks); await persist({ tasks: nextTasks, appointments, documents }); }, [appointments, documents, persist, tasks]);
  const updateTaskStatus = useCallback(async (id: string, status: WorkspaceTask["status"]) => { const nextTasks = tasks.map((task) => task.id === id ? { ...task, status } : task); setTasks(nextTasks); await persist({ tasks: nextTasks, appointments, documents }); }, [appointments, documents, persist, tasks]);
  const addAppointment = useCallback(async (appointment: Omit<WorkspaceAppointment, "id">) => { const nextAppointments = [{ ...appointment, id: `appointment-${Date.now()}` }, ...appointments]; setAppointments(nextAppointments); await persist({ tasks, appointments: nextAppointments, documents }); }, [appointments, documents, persist, tasks]);
  const addDocument = useCallback(async (document: Omit<WorkspaceDocument, "id" | "addedAt" | "verificationStatus">) => { const nextDocuments = [{ ...document, id: `document-${Date.now()}`, addedAt: new Date().toISOString(), verificationStatus: "pending" as const }, ...documents]; setDocuments(nextDocuments); await persist({ tasks, appointments, documents: nextDocuments }); }, [appointments, documents, persist, tasks]);

  const value = useMemo(() => ({ isLoading, tasks, appointments, documents, addTask, updateTaskStatus, addAppointment, addDocument }), [addAppointment, addDocument, addTask, appointments, documents, isLoading, tasks, updateTaskStatus]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() { const context = useContext(WorkspaceContext); if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider"); return context; }
