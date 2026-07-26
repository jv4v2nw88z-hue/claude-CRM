import { api, qs } from "./apiClient";
import type {
  AuditEntry,
  AutomationRule,
  ClientAccess,
  ClientDetail,
  ClientListItem,
  Contact,
  DashboardSummary,
  Deal,
  DealStageEntry,
  Document,
  Interaction,
  PipelineStage,
  Retainer,
  RevenueSummary,
  Task,
  User,
} from "../types";

// ---------------------------
// Auth
// ---------------------------

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User }>("/auth/login", { email, password }),
  logout: () => api.post<void>("/auth/logout"),
  me: () => api.get<{ user: User }>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ user: User }>("/auth/change-password", { currentPassword, newPassword }),
};

export const usersApi = {
  list: () => api.get<User[]>("/users"),
};

// ---------------------------
// Clients
// ---------------------------

export interface ClientFilters {
  tier?: string;
  search?: string;
  ownerId?: string;
  atRisk?: boolean;
  /** Flips the list to soft-deleted clients. */
  archived?: boolean;
}

export const clientsApi = {
  list: (filters: ClientFilters = {}) =>
    api.get<ClientListItem[]>(
      `/clients${qs({
        ...filters,
        atRisk: filters.atRisk || undefined,
        archived: filters.archived || undefined,
      })}`
    ),
  detail: (id: string) => api.get<ClientDetail>(`/clients/${id}`),
  create: (data: Record<string, unknown>) => api.post<ClientListItem>("/clients", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<ClientListItem>(`/clients/${id}`, data),
  changeTier: (id: string, newTier: string, note?: string) =>
    api.patch<ClientDetail>(`/clients/${id}/tier`, { newTier, note }),
  remove: (id: string) => api.delete<void>(`/clients/${id}`),
  restore: (id: string) => api.post<ClientDetail>(`/clients/${id}/restore`),
  access: (id: string) => api.get<ClientAccess>(`/clients/${id}/access`),
  grantAccess: (id: string, userId: string) =>
    api.post<void>(`/clients/${id}/access`, { userId }),
  revokeAccess: (id: string, userId: string) =>
    api.delete<void>(`/clients/${id}/access/${userId}`),
  transferOwnership: (id: string, accountOwnerId: string) =>
    api.patch<ClientDetail>(`/clients/${id}/owner`, { accountOwnerId }),
  audit: (id: string) => api.get<{ entries: AuditEntry[] }>(`/clients/${id}/audit`),
};

export const contactsApi = {
  listForClient: (clientId: string) => api.get<Contact[]>(`/clients/${clientId}/contacts`),
  create: (clientId: string, data: Record<string, unknown>) =>
    api.post<Contact>(`/clients/${clientId}/contacts`, data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Contact>(`/contacts/${id}`, data),
  remove: (id: string) => api.delete<void>(`/contacts/${id}`),
  restore: (id: string) => api.post<Contact>(`/contacts/${id}/restore`),
};

// ---------------------------
// Retainers
// ---------------------------

export const retainersApi = {
  list: () => api.get<Retainer[]>("/retainers"),
  listForClient: (clientId: string) => api.get<Retainer[]>(`/clients/${clientId}/retainers`),
  create: (clientId: string, data: Record<string, unknown>) =>
    api.post<Retainer>(`/clients/${clientId}/retainers`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Retainer>(`/retainers/${id}`, data),
  remove: (id: string) => api.delete<void>(`/retainers/${id}`),
  restore: (id: string) => api.post<Retainer>(`/retainers/${id}/restore`),
};

// ---------------------------
// Tasks
// ---------------------------

export interface TaskFilters {
  assignedToId?: string;
  status?: string;
  clientId?: string;
  type?: string;
  dueBefore?: string;
  includeCompleted?: boolean;
}

export const tasksApi = {
  list: (filters: TaskFilters = {}) => api.get<Task[]>(`/tasks${qs({ ...filters })}`),
  create: (data: Record<string, unknown>) => api.post<Task>("/tasks", data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Task>(`/tasks/${id}`, data),
  complete: (id: string) => api.post<Task>(`/tasks/${id}/complete`),
  remove: (id: string) => api.delete<void>(`/tasks/${id}`),
};

// ---------------------------
// Interactions
// ---------------------------

export const interactionsApi = {
  listForClient: (clientId: string) => api.get<Interaction[]>(`/clients/${clientId}/interactions`),
  create: (clientId: string, data: Record<string, unknown>) =>
    api.post<Interaction>(`/clients/${clientId}/interactions`, data),
  recent: (limit = 10) => api.get<Interaction[]>(`/interactions${qs({ limit })}`),
};

// ---------------------------
// Deals
// ---------------------------

export const dealsApi = {
  list: () => api.get<Deal[]>("/deals"),
  create: (data: Record<string, unknown>) => api.post<Deal>("/deals", data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Deal>(`/deals/${id}`, data),
  convert: (id: string, data: Record<string, unknown> = {}) =>
    api.post<ClientDetail>(`/deals/${id}/convert`, data),
  remove: (id: string) => api.delete<void>(`/deals/${id}`),
  stageHistory: (id: string) =>
    api.get<{ entries: DealStageEntry[] }>(`/deals/${id}/stage-history`),
};

// ---------------------------
// Pipeline stages
// ---------------------------

export const pipelineStagesApi = {
  list: () => api.get<PipelineStage[]>("/pipeline-stages"),
  create: (data: { name: string; isWon?: boolean; isLost?: boolean }) =>
    api.post<PipelineStage>("/pipeline-stages", data),
  update: (id: string, data: { name?: string; isWon?: boolean; isLost?: boolean }) =>
    api.patch<PipelineStage>(`/pipeline-stages/${id}`, data),
  /** Sends the whole ordering, not one stage's index — see the route's comment. */
  reorder: (ids: string[]) => api.patch<PipelineStage[]>("/pipeline-stages/reorder", { ids }),
  remove: (id: string, reassignToId?: string) =>
    api.delete<{ movedDeals: number }>(
      `/pipeline-stages/${id}`,
      reassignToId ? { reassignToId } : undefined
    ),
};

// ---------------------------
// Documents
// ---------------------------

export const documentsApi = {
  listForClient: (clientId: string) => api.get<Document[]>(`/clients/${clientId}/documents`),
  config: () => api.get<{ storageEnabled: boolean }>("/documents/config"),
  // One request: the Worker streams the bytes into R2 and writes the row. R2 is
  // reached through a binding rather than S3 credentials, so there is no
  // presigned URL to hand the browser and no second confirm call.
  upload: (clientId: string, file: File, category?: string | null) => {
    const form = new FormData();
    form.append("file", file);
    if (category) form.append("category", category);
    return api.postForm<Document>(`/clients/${clientId}/documents`, form);
  },
  downloadUrl: (id: string) => api.get<{ url: string }>(`/documents/${id}/download-url`),
  remove: (id: string) => api.delete<void>(`/documents/${id}`),
};

// ---------------------------
// Dashboard / revenue
// ---------------------------

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>("/dashboard/summary"),
  revenue: () => api.get<RevenueSummary>("/dashboard/revenue"),
};

// ---------------------------
// Automation rules
// ---------------------------

export const automationRulesApi = {
  list: () => api.get<AutomationRule[]>("/automation-rules"),
  create: (data: Record<string, unknown>) => api.post<AutomationRule>("/automation-rules", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<AutomationRule>(`/automation-rules/${id}`, data),
  remove: (id: string) => api.delete<void>(`/automation-rules/${id}`),
  runNow: () =>
    api.post<{ clientsChecked: number; rulesChecked: number; tasksCreated: unknown[] }>(
      "/automation-rules/run"
    ),
};
