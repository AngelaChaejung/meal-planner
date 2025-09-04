import { createClient } from '@supabase/supabase-js'

// 환경 변수에서 Supabase 설정 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// 식사 데이터 타입 정의 (간소화)
export interface Meal {
  id?: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'other';
  memo: string; // 메모 필드 하나로 통합
  created_at?: string;
  updated_at?: string;
}

// 주간 메모 데이터 타입 정의
export interface WeeklyMemo {
  id?: string;
  week_start_date: string; // YYYY-MM-DD (해당 주의 월요일)
  memo: string;
  created_at?: string;
  updated_at?: string;
}

// 식사 API 함수들
export const mealService = {
  // 모든 식사 가져오기
  async getAllMeals(): Promise<Meal[]> {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .order('date', { ascending: true })
      .order('meal_type', { ascending: true });
    
    if (error) {
      console.error('식사 데이터 가져오기 오류:', error);
      throw error;
    }
    
    return data || [];
  },

  // 특정 기간의 식사 가져오기
  async getMealsByDateRange(startDate: string, endDate: string): Promise<Meal[]> {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('meal_type', { ascending: true });
    
    if (error) {
      console.error('기간별 식사 데이터 가져오기 오류:', error);
      throw error;
    }
    
    return data || [];
  },

  // 새 식사 추가
  async addMeal(meal: Omit<Meal, 'id' | 'created_at' | 'updated_at'>): Promise<Meal> {
    const { data, error } = await supabase
      .from('meals')
      .insert([meal])
      .select()
      .single();
    
    if (error) {
      console.error('식사 추가 오류:', error);
      throw error;
    }
    
    return data;
  },

  // 식사 수정
  async updateMeal(id: string, meal: Partial<Meal>): Promise<Meal> {
    const { data, error } = await supabase
      .from('meals')
      .update(meal)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('식사 수정 오류:', error);
      throw error;
    }
    
    return data;
  },

  // 식사 삭제
  async deleteMeal(id: string): Promise<void> {
    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('식사 삭제 오류:', error);
      throw error;
    }
  },

  // 특정 날짜와 식사 타입의 식사 가져오기
  async getMealByDateAndType(date: string, mealType: 'breakfast' | 'lunch' | 'dinner'): Promise<Meal | null> {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('date', date)
      .eq('meal_type', mealType)
      .single();
    
    if (error) {
      // 데이터가 없는 경우는 오류가 아님
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('식사 데이터 가져오기 오류:', error);
      throw error;
    }
    
    return data;
  },

  // 기존 식사가 있으면 수정, 없으면 추가
  async upsertMeal(meal: Omit<Meal, 'id' | 'created_at' | 'updated_at'>): Promise<Meal> {
    const { data, error } = await supabase
      .from('meals')
      .upsert([meal], {
        onConflict: 'date,meal_type',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (error) {
      console.error('식사 저장 오류:', error);
      throw error;
    }
    
    return data;
  }
};

// 주간 메모 API 함수들
export const weeklyMemoService = {
  // 특정 주차의 메모 조회
  async getWeeklyMemo(weekStartDate: string): Promise<WeeklyMemo | null> {
    try {
      // 먼저 데이터가 있는지 확인 (single() 사용하지 않음)
      const { data, error } = await supabase
        .from('weekly_memos')
        .select('*')
        .eq('week_start_date', weekStartDate)
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          // 테이블이 존재하지 않는 경우
          console.warn('⚠️ weekly_memos 테이블이 아직 생성되지 않았습니다. Supabase에서 테이블을 생성해주세요.');
          return null;
        }
        console.error('주간 메모 가져오기 오류:', error);
        return null; // 오류 시 null 반환하여 앱 크래시 방지
      }

      // 데이터가 없으면 null, 있으면 첫 번째 항목 반환
      return data && data.length > 0 ? data[0] : null;
      
    } catch (err) {
      console.warn('⚠️ 주간 메모 서비스 오류 (테이블이 존재하지 않을 수 있습니다):', err);
      return null; // 모든 오류에 대해 null 반환
    }
  },

  // 주간 메모 추가 또는 업데이트
  async upsertWeeklyMemo(memo: Omit<WeeklyMemo, 'id' | 'created_at' | 'updated_at'>): Promise<WeeklyMemo> {
    try {
      const { data, error } = await supabase
        .from('weekly_memos')
        .upsert([memo], {
          onConflict: 'week_start_date',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('⚠️ weekly_memos 테이블이 존재하지 않습니다. Supabase에서 먼저 테이블을 생성해주세요.');
        }
        console.error('주간 메모 저장 오류:', error);
        throw error;
      }

      return data;
    } catch (err) {
      console.error('주간 메모 upsert 오류:', err);
      throw err;
    }
  },

  // 주간 메모 삭제
  async deleteWeeklyMemo(id: string): Promise<void> {
    const { error } = await supabase
      .from('weekly_memos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('주간 메모 삭제 오류:', error);
      throw error;
    }
  }
};
