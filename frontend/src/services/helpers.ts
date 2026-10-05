import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * A mutation that invalidates the given query keys on success. Errors are surfaced
 * by the global MutationCache handler (a toast) unless `meta.silentError` is set.
 */
export function useInvalidatingMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidate: QueryKey[] | ((data: TData, vars: TVars) => QueryKey[]),
  options: { silentError?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    meta: { silentError: options.silentError },
    onSuccess: async (data, vars) => {
      const keys = typeof invalidate === "function" ? invalidate(data, vars) : invalidate;
      await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
    },
  });
}

export type QueryParamsOf<T> = { [K in keyof T]?: T[K] };

/** Drop undefined/empty values so they don't fragment the query cache. */
export function cleanQuery<T extends object>(q: T): T {
  return Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)),
  ) as T;
}
