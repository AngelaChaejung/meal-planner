export interface Meal {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'other';
  memo: string; // 메모 필드 하나로 통합
  date: string; // YYYY-MM-DD 형식
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyMeals {
  date: string; // YYYY-MM-DD 형식
  breakfast?: Meal;
  lunch?: Meal;
  dinner?: Meal;
}

export interface WeeklyPlan {
  id: string;
  startDate: string; // YYYY-MM-DD 형식
  endDate: string; // YYYY-MM-DD 형식
  title: string;
  days: DailyMeals[];
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  type: 'user' | 'partner';
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'other';
export type UserType = 'user' | 'partner';
