import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  automationRulesApi,
  clientsApi,
  contactsApi,
  dashboardApi,
  dealsApi,
  documentsApi,
  interactionsApi,
  retainersApi,
  tasksApi,
  usersApi,
  type ClientFilters,
  type TaskFilters,
} from "../api/resources";
import type { Task } from "../types";

export const queryKeys = {
  clients: (filters?: ClientFilters) => ["clients", filters ?? {}] as const,
  client: (id: string) => ["client", id] as const,
  tasks: (filters?: TaskFilters) => ["tasks", filters ?? {}] as const,
  retainers: () => ["retainers"] as const,
  clientRetainers: (clientId: string) => ["retainers", clientId] as const,
  deals: () => ["deals"] as const,
  documents: (clientId: string) => ["documents", clientId] as const,
  documentConfig: () => ["documents", "config"] as const,
  dashboard: () => ["dashboard", "summary"] as const,
  revenue: () => ["dashboard", "revenue"] as const,
  automationRules: () => ["automation-rules"] as const,
  users: () => ["users"] as const,
};

/**
 * Anything that changes tier, money or task state ripples into the dashboard
 * and the client roster, so mutations invalidate broadly rather than trying to
 * surgically patch caches. At 5–30 clients the refetch is free.
 */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    queryClient.invalidateQueries({ queryKey: ["client"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["retainers"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["deals"] });
  };
}

// ---------------------------
// Users
// ---------------------------

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users(), queryFn: usersApi.list, staleTime: 5 * 60_000 });
}

// ---------------------------
// Clients
// ---------------------------

export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: queryKeys.clients(filters),
    queryFn: () => clientsApi.list(filters),
  });
}

export function useClientDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.client(id ?? ""),
    queryFn: () => clientsApi.detail(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => clientsApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateClient(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => clientsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useChangeTier(id: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ newTier, note }: { newTier: string; note?: string }) =>
      clientsApi.changeTier(id, newTier, note),
    onSuccess: invalidate,
  });
}

export function useDeleteClient() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => clientsApi.remove(id), onSuccess: invalidate });
}

// ---------------------------
// Contacts
// ---------------------------

export function useCreateContact(clientId: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => contactsApi.create(clientId, data),
    onSuccess: invalidate,
  });
}

export function useUpdateContact() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      contactsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteContact() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => contactsApi.remove(id), onSuccess: invalidate });
}

// ---------------------------
// Tasks
// ---------------------------

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({ queryKey: queryKeys.tasks(filters), queryFn: () => tasksApi.list(filters) });
}

/**
 * Optimistic completion: the checkbox has to fill the instant it's clicked, or
 * Cole ticks it twice while standing in a parking lot.
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAll();

  return useMutation({
    mutationFn: (taskId: string) => tasksApi.complete(taskId),
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const snapshot = queryClient.getQueriesData<Task[]>({ queryKey: ["tasks"] });

      queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
        old?.map((t) =>
          t.id === taskId
            ? { ...t, status: "DONE" as const, completedAt: new Date().toISOString() }
            : t
        )
      );

      // Handed to onError so a failed request puts every list back as it was.
      return { snapshot };
    },
    onError: (_err, _taskId, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: invalidate,
  });
}

export function useCreateTask() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      tasksApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => tasksApi.remove(id), onSuccess: invalidate });
}

// ---------------------------
// Interactions
// ---------------------------

export function useLogInteraction(clientId: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => interactionsApi.create(clientId, data),
    onSuccess: invalidate,
  });
}

// ---------------------------
// Retainers
// ---------------------------

export function useRetainers() {
  return useQuery({ queryKey: queryKeys.retainers(), queryFn: retainersApi.list });
}

export function useCreateRetainer(clientId: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => retainersApi.create(clientId, data),
    onSuccess: invalidate,
  });
}

export function useUpdateRetainer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      retainersApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteRetainer() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => retainersApi.remove(id), onSuccess: invalidate });
}

// ---------------------------
// Deals
// ---------------------------

export function useDeals() {
  return useQuery({ queryKey: queryKeys.deals(), queryFn: dealsApi.list });
}

export function useCreateDeal() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => dealsApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      dealsApi.update(id, data),
    // The kanban card must land in its new column the moment it's dropped.
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.deals() });
      const previous = queryClient.getQueryData(queryKeys.deals());
      queryClient.setQueryData(queryKeys.deals(), (old: unknown) =>
        Array.isArray(old)
          ? old.map((d) => ((d as { id: string }).id === id ? { ...d, ...data } : d))
          : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: unknown } | undefined;
      if (ctx?.previous !== undefined) queryClient.setQueryData(queryKeys.deals(), ctx.previous);
    },
    onSettled: invalidate,
  });
}

export function useConvertDeal() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      dealsApi.convert(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteDeal() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => dealsApi.remove(id), onSuccess: invalidate });
}

// ---------------------------
// Documents
// ---------------------------

export function useDocumentConfig() {
  return useQuery({
    queryKey: queryKeys.documentConfig(),
    queryFn: documentsApi.config,
    staleTime: Infinity,
  });
}

export function useUploadDocument(clientId: string) {
  const invalidate = useInvalidateAll();
  const queryClient = useQueryClient();

  return useMutation({
    // One round trip: the Worker writes the object to R2 and the row together,
    // so a failed upload can no longer leave a document listed with nothing
    // behind it.
    mutationFn: ({ file, category }: { file: File; category?: string }) =>
      documentsApi.upload(clientId, file, category || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(clientId) });
      invalidate();
    },
  });
}

export function useDeleteDocument() {
  const invalidate = useInvalidateAll();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      invalidate();
    },
  });
}

// ---------------------------
// Dashboard / revenue
// ---------------------------

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: dashboardApi.summary,
    refetchOnWindowFocus: true,
  });
}

export function useRevenueSummary() {
  return useQuery({ queryKey: queryKeys.revenue(), queryFn: dashboardApi.revenue });
}

// ---------------------------
// Automation rules
// ---------------------------

export function useAutomationRules() {
  return useQuery({ queryKey: queryKeys.automationRules(), queryFn: automationRulesApi.list });
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => automationRulesApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.automationRules() }),
  });
}

export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      automationRulesApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.automationRules() }),
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationRulesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.automationRules() }),
  });
}

export function useRunAutomationNow() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: automationRulesApi.runNow, onSuccess: invalidate });
}
