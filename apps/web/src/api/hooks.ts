/**
 * Доступ к данным через TanStack Query.
 *
 * Мутации сметы возвращают ВЕСЬ пересчитанный документ, а не «ок». Поэтому
 * они кладут ответ прямо в кеш: интерфейс сразу показывает суммы, посчитанные
 * сервером тем же движком, что и в PDF. Оптимистичных подсчётов на клиенте
 * здесь сознательно нет — цифра в смете должна быть одна.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { EstimateStatus, Role } from '@yaspectr/core';
import { api } from './client.js';
import type {
  CatalogCategory,
  CatalogItem,
  CompanyUser,
  Estimate,
  EstimateListItem,
  EstimateWithChanges,
  KitTemplate,
  Paged,
  WorkAct,
  WorkActListItem,
} from './types.js';

export const keys = {
  catalog: (search?: string) => ['catalog', search ?? ''] as const,
  categories: ['categories'] as const,
  kits: ['kits'] as const,
  estimates: (search?: string) => ['estimates', search ?? ''] as const,
  estimate: (id: string) => ['estimate', id] as const,
  acts: (search?: string) => ['acts', search ?? ''] as const,
  act: (id: string) => ['act', id] as const,
  users: ['users'] as const,
};

// ─────────────────────────────────────────────────────────────
// Справочник
// ─────────────────────────────────────────────────────────────

export function useCatalog(search?: string) {
  return useQuery({
    queryKey: keys.catalog(search),
    queryFn: () =>
      api.get<Paged<CatalogItem>>(
        `/catalog/items?perPage=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.get<CatalogCategory[]>('/catalog/categories'),
  });
}

export function useSaveCatalogItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CatalogItem> & { id?: string }) =>
      id
        ? api.patch<CatalogItem>(`/catalog/items/${id}`, body)
        : api.post<CatalogItem>('/catalog/items', body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

export function useArchiveCatalogItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<CatalogItem>(`/catalog/items/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Комплекты
// ─────────────────────────────────────────────────────────────

export function useKits() {
  return useQuery({ queryKey: keys.kits, queryFn: () => api.get<KitTemplate[]>('/kits') });
}

/** Строка комплекта в том виде, в каком её принимает сервер. */
export interface KitLinePayload {
  itemId: string;
  qtyMode: 'PER_ROOT' | 'FIXED';
  qtyPerRoot: number;
  minPerRoot?: number | null;
  maxPerRoot?: number | null;
  isOptional?: boolean;
  sortOrder?: number;
}

export interface KitSavePayload {
  id?: string;
  name: string;
  rootItemId: string;
  isDefault: boolean;
  lines: KitLinePayload[];
}

export function useSaveKit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: KitSavePayload) =>
      id ? api.patch<KitTemplate>(`/kits/${id}`, body) : api.post<KitTemplate>('/kits', body),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.kits }),
  });
}

export function useArchiveKit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<KitTemplate>(`/kits/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.kits }),
  });
}

// ─────────────────────────────────────────────────────────────
// Сметы
// ─────────────────────────────────────────────────────────────

export function useEstimates(search?: string) {
  return useQuery({
    queryKey: keys.estimates(search),
    queryFn: () =>
      api.get<Paged<EstimateListItem>>(
        `/estimates?perPage=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
}

export function useEstimate(id: string | undefined, options?: Partial<UseQueryOptions<Estimate>>) {
  return useQuery({
    queryKey: keys.estimate(id ?? ''),
    queryFn: () => api.get<Estimate>(`/estimates/${id}`),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCreateEstimate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      clientName?: string | null;
      clientPhone?: string | null;
      siteAddress?: string | null;
      positions: never[];
    }) => api.post<Estimate>('/estimates', body),
    onSuccess: (estimate) => {
      client.setQueryData(keys.estimate(estimate.id), estimate);
      void client.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}

/**
 * Мутации одной сметы. Все они возвращают документ целиком, поэтому кладём
 * ответ в кеш напрямую — лишний перезапрос ради тех же данных не нужен.
 */
function useEstimateMutation<TVars>(
  estimateId: string,
  fn: (vars: TVars) => Promise<EstimateWithChanges>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (estimate) => {
      client.setQueryData(keys.estimate(estimateId), estimate);
      void client.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}

export function useAddPosition(estimateId: string) {
  return useEstimateMutation(estimateId, (vars: { catalogItemId: string; qty: number }) =>
    api.post<EstimateWithChanges>(`/estimates/${estimateId}/positions`, vars),
  );
}

export function useUpdatePositionQty(estimateId: string) {
  return useEstimateMutation(estimateId, (vars: { positionId: string; qty: number }) =>
    api.patch<EstimateWithChanges>(`/estimates/${estimateId}/positions/${vars.positionId}`, {
      qty: vars.qty,
    }),
  );
}

export function useRemovePosition(estimateId: string) {
  return useEstimateMutation(estimateId, (positionId: string) =>
    api.delete<EstimateWithChanges>(`/estimates/${estimateId}/positions/${positionId}`),
  );
}

export function useUpdateLine(estimateId: string) {
  return useEstimateMutation(
    estimateId,
    ({ lineId, ...patch }: { lineId: string } & Record<string, unknown>) =>
      api.patch<EstimateWithChanges>(`/estimates/${estimateId}/lines/${lineId}`, patch),
  );
}

export function useUpdateEstimate(estimateId: string) {
  return useEstimateMutation(estimateId, (patch: Record<string, unknown>) =>
    api.patch<EstimateWithChanges>(`/estimates/${estimateId}`, patch),
  );
}

export function useRepriceEstimate(estimateId: string) {
  return useEstimateMutation(estimateId, () =>
    api.post<EstimateWithChanges>(`/estimates/${estimateId}/reprice`),
  );
}

export function useSetEstimateStatus(estimateId: string) {
  return useEstimateMutation(estimateId, (status: EstimateStatus) =>
    api.patch<EstimateWithChanges>(`/estimates/${estimateId}/status`, { status }),
  );
}

export function useDeleteEstimate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (estimateId: string) => api.delete<void>(`/estimates/${estimateId}`),
    onSuccess: (_data, estimateId) => {
      client.removeQueries({ queryKey: keys.estimate(estimateId) });
      void client.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Акты
// ─────────────────────────────────────────────────────────────

export function useActs(search?: string) {
  return useQuery({
    queryKey: keys.acts(search),
    queryFn: () =>
      api.get<Paged<WorkActListItem>>(
        `/acts?perPage=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
}

export function useAct(id: string | undefined) {
  return useQuery({
    queryKey: keys.act(id ?? ''),
    queryFn: () => api.get<WorkAct>(`/acts/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateActFromEstimate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      estimateId: string;
      installerName: string;
      workDate: string;
      includeMaterials?: boolean;
    }) => api.post<WorkAct>('/acts/from-estimate', body),
    onSuccess: (act) => {
      client.setQueryData(keys.act(act.id), act);
      void client.invalidateQueries({ queryKey: ['acts'] });
    },
  });
}

export function useToggleActItem(actId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      ...patch
    }: { itemId: string; isDone?: boolean; isChecked?: boolean; qtyDone?: number }) =>
      api.patch<WorkAct>(`/acts/${actId}/items/${itemId}`, patch),
    onSuccess: (act) => {
      client.setQueryData(keys.act(actId), act);
      void client.invalidateQueries({ queryKey: ['acts'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Пользователи
// ─────────────────────────────────────────────────────────────

export function useUsers(enabled: boolean) {
  return useQuery({
    queryKey: keys.users,
    queryFn: () => api.get<CompanyUser[]>('/users'),
    enabled,
  });
}

export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      email: string;
      password: string;
      fullName: string;
      role: Role;
      phone?: string | null;
    }) => api.post<CompanyUser>('/users', body),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.users }),
  });
}

export function useUpdateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      fullName?: string;
      phone?: string | null;
      role?: Role;
      isActive?: boolean;
    }) => api.patch<CompanyUser>(`/users/${id}`, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.users }),
  });
}

export function useResetUserPassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api.post<void>(`/users/${id}/reset-password`, { newPassword }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.users }),
  });
}
