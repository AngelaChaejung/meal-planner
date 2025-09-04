'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5분 동안 데이터를 fresh로 간주
        gcTime: 1000 * 60 * 30, // 30분 동안 캐시 유지
        refetchOnWindowFocus: false, // 창 포커스 시 자동 refetch 비활성화
        refetchOnMount: true, // 컴포넌트 마운트 시 refetch
        retry: 3, // 실패 시 3번까지 재시도
      },
      mutations: {
        retry: 1, // mutation 실패 시 1번까지 재시도
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
