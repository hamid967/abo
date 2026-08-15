import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAccount } from "@/hooks/use-account";
import { trpc } from "@/lib/trpc";
import { getAccountStorageKey } from "@/lib/cloud-storage";

export type WorkspaceTask = { id: string; title: string; description?: string; priority: "low" | "normal" | "high" | "urgent"; status: "new" | "in_progress" | "awaiting_customer" | "completed" | "overdue"; dueDate?: string; transactionId?: string; };
export type WorkspaceAppointment = { id: string; title: string; location?: string; startsAt: string; status: "scheduled" | "completed" | "cancelled"; transactionId?: string; };
export type WorkspaceDocument = { id: string; name: string; mimeType?: string; size?: number; uri: string; addedAt: string; transactionId?: string; verificationStatus: "pending" | "verified" | "rejected"; cloudKey?: string; };

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
  const account = useAccount();
  const cloudRecord = trpc.cloud.get.useQuery({ recordType: "workspace" }, { enabled: account.isAuthenticated, retry: 1 });
  const cloudPut = trpc.cloud.put.useMutation();
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [appointments, setAppointments] = useState<WorkspaceAppointment[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = getAccountStorageKey(STORAGE_KEY, account.isAuthenticated ? account.user?.id : undefined);
  const persist = useCallback(async (next: { tasks: WorkspaceTask[]; appointments: WorkspaceAppointment[]; documents: WorkspaceDocument[] }) => AsyncStorage.setItem(storageKey, JSON.stringify(next)), [storageKey]);

  useEffect(() => { void (async () => { setIsLoading(true); setTasks([]); setAppointments([]); setDocuments([]); try { const raw = await AsyncStorage.getItem(storageKey); if (raw) { const parsed = JSON.parse(raw) as Partial<{ tasks: WorkspaceTask[]; appointments: WorkspaceAppointment[]; documents: WorkspaceDocument[] }>; setTasks(parsed.tasks ?? []); setAppointments(parsed.appointments ?? []); setDocuments(parsed.documents ?? []); } } finally { setIsLoading(false); } })(); }, [storageKey]);

  useEffect(() => {
    if (!account.isAuthenticated || isLoading || cloudRecord.isLoading) return;
    const payload = cloudRecord.data?.payload as Partial<{ tasks: WorkspaceTask[]; appointments: WorkspaceAppointment[]; documents: WorkspaceDocument[] }> | undefined;
    if (payload && Array.isArray(payload.tasks) && Array.isArray(payload.appointments) && Array.isArray(payload.documents)) {
      setTasks(payload.tasks); setAppointments(payload.appointments); setDocuments(payload.documents);
      return;
    }
    if (!cloudRecord.data && (tasks.length || appointments.length || documents.length)) void cloudPut.mutateAsync({ recordType: "workspace", payload: { tasks, appointments, documents } }).catch(() => undefined);
  }, [account.isAuthenticated, appointments, cloudPut, cloudRecord.data, cloudRecord.isLoading, documents, isLoading, tasks]);

  const sync = useCallback(async (next: { tasks: WorkspaceTask[]; appointments: WorkspaceAppointment[]; documents: WorkspaceDocument[] }) => {
    await persist(next);
    if (account.isAuthenticated) {
      try { await cloudPut.mutateAsync({ recordType: "workspace", payload: next }); } catch { /* تبقى النسخة المحلية متاحة عند انقطاع الشبكة. */ }
    }
  }, [account.isAuthenticated, cloudPut, persist]);

  const addTask = useCallback(async (task: Omit<WorkspaceTask, "id">) => { const nextTasks = [{ ...task, id: `task-${Date.now()}` }, ...tasks]; setTasks(nextTasks); await sync({ tasks: nextTasks, appointments, documents }); }, [appointments, documents, sync, tasks]);
  const updateTaskStatus = useCallback(async (id: string, status: WorkspaceTask["status"]) => { const nextTasks = tasks.map((task) => task.id === id ? { ...task, status } : task); setTasks(nextTasks); await sync({ tasks: nextTasks, appointments, documents }); }, [appointments, documents, sync, tasks]);
  const addAppointment = useCallback(async (appointment: Omit<WorkspaceAppointment, "id">) => { const nextAppointments = [{ ...appointment, id: `appointment-${Date.now()}` }, ...appointments]; setAppointments(nextAppointments); await sync({ tasks, appointments: nextAppointments, documents }); }, [appointments, documents, sync, tasks]);
  const addDocument = useCallback(async (document: Omit<WorkspaceDocument, "id" | "addedAt" | "verificationStatus">) => { const nextDocuments = [{ ...document, id: `document-${Date.now()}`, addedAt: new Date().toISOString(), verificationStatus: "pending" as const }, ...documents]; setDocuments(nextDocuments); await sync({ tasks, appointments, documents: nextDocuments }); }, [appointments, documents, sync, tasks]);

  const value = useMemo(() => ({ isLoading: isLoading || (account.isAuthenticated && cloudRecord.isLoading), tasks, appointments, documents, addTask, updateTaskStatus, addAppointment, addDocument }), [account.isAuthenticated, addAppointment, addDocument, addTask, appointments, cloudRecord.isLoading, documents, isLoading, tasks, updateTaskStatus]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() { const context = useContext(WorkspaceContext); if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider"); return context; }
