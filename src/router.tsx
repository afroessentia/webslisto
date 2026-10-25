import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { invalidateLeadMetrics } from "@/lib/lead-metrics";

export const getRouter = () => {
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      // Every successful write invalidates metrics, including future lead imports.
      onSuccess: () => invalidateLeadMetrics(queryClient),
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
