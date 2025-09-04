import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mealService, weeklyMemoService, type Meal, type WeeklyMemo } from '@/lib/supabase';

// 식사 데이터를 가져오는 hook
export function useMeals(startDateStr: string, endDateStr: string) {
  return useQuery({
    queryKey: ['meals', startDateStr, endDateStr],
    queryFn: () => mealService.getMealsByDateRange(startDateStr, endDateStr),
    staleTime: 1000 * 60 * 5, // 5분
    gcTime: 1000 * 60 * 30, // 30분
  });
}

// 주간 메모 데이터를 가져오는 hook
export function useWeeklyMemos(weekStartDates: string[]) {
  return useQuery({
    queryKey: ['weeklyMemos', ...weekStartDates],
    queryFn: async () => {
      const memoPromises = weekStartDates.map(async (weekStart) => {
        try {
          const memo = await weeklyMemoService.getWeeklyMemo(weekStart);
          return { weekStart, memo };
        } catch (error) {
          console.log('주간 메모 로드 중 오류 (정상적일 수 있음):', error);
          return { weekStart, memo: null };
        }
      });
      
      const memoResults = await Promise.all(memoPromises);
      const memosMap: {[key: string]: WeeklyMemo} = {};
      memoResults.forEach(({ weekStart, memo }) => {
        if (memo) {
          memosMap[weekStart] = memo;
        }
      });
      
      return memosMap;
    },
    staleTime: 1000 * 60 * 5, // 5분
    gcTime: 1000 * 60 * 30, // 30분
  });
}

// 식사 추가/수정 mutation
export function useMealMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (meal: { date: string; mealType: string; memo: string; id?: string }) => 
      mealService.upsertMeal(meal),
    onSuccess: (data, variables) => {
      // 관련된 쿼리들을 무효화해서 자동 refetch
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      console.log('✅ 식사 데이터 저장 성공:', data);
    },
    onError: (error) => {
      console.error('❌ 식사 데이터 저장 실패:', error);
    },
  });
}

// 식사 삭제 mutation
export function useDeleteMealMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (mealId: string) => mealService.deleteMeal(mealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      console.log('✅ 식사 삭제 성공');
    },
    onError: (error) => {
      console.error('❌ 식사 삭제 실패:', error);
    },
  });
}

// 주간 메모 추가/수정 mutation
export function useWeeklyMemoMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (memo: { weekStartDate: string; memo: string; id?: string }) => 
      weeklyMemoService.upsertWeeklyMemo(memo),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['weeklyMemos'] });
      console.log('✅ 주간 메모 저장 성공:', data);
    },
    onError: (error) => {
      console.error('❌ 주간 메모 저장 실패:', error);
    },
  });
}

// 주간 메모 삭제 mutation
export function useDeleteWeeklyMemoMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (memoId: string) => weeklyMemoService.deleteWeeklyMemo(memoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyMemos'] });
      console.log('✅ 주간 메모 삭제 성공');
    },
    onError: (error) => {
      console.error('❌ 주간 메모 삭제 실패:', error);
    },
  });
}
