'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  formatDateKorean, 
  getTwoWeekDates, 
  getCurrentTwoWeekRange,
  getPreviousTwoWeekStart,
  getNextTwoWeekStart,
  getTwoWeekRangeFromDate,
  formatDate
} from '@/utils/date';
import { mealService, weeklyMemoService, type Meal, type WeeklyMemo } from '@/lib/supabase';

// 테마 훅
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // 로컬스토리지에서 테마 불러오기
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // 시스템 테마 감지
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(systemTheme);
    }
  }, []);

  useEffect(() => {
    // 테마 적용
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggleTheme };
}

// 식사 타입
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'other';

// 식사 정보 - 애플 캘린더 스타일
const MEAL_INFO = {
  breakfast: { 
    title: '아침', 
    shortTitle: '아',
    color: 'text-orange-500 bg-orange-500/10 dark:text-orange-400 dark:bg-orange-400/10',
    dotColor: 'bg-orange-500 dark:bg-orange-400'
  },
  lunch: { 
    title: '점심', 
    shortTitle: '점',
    color: 'text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-400/10',
    dotColor: 'bg-amber-600 dark:bg-amber-400'
  },
  dinner: { 
    title: '저녁', 
    shortTitle: '저',
    color: 'text-purple-600 bg-purple-500/10 dark:text-purple-400 dark:bg-purple-400/10',
    dotColor: 'bg-purple-600 dark:bg-purple-400'
  },
  other: {
    title: '기타',
    shortTitle: '기',
    color: 'text-gray-600 bg-gray-500/10 dark:text-gray-400 dark:bg-gray-400/10',
    dotColor: 'bg-gray-600 dark:bg-gray-400'
  }
};

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<{date: string, mealType: MealType} | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 주간 메모 상태
  const [weeklyMemos, setWeeklyMemos] = useState<{[weekStartDate: string]: WeeklyMemo}>({});
  const [selectedWeeklyMemo, setSelectedWeeklyMemo] = useState<string | null>(null);
  const [isWeeklyMemoModalOpen, setIsWeeklyMemoModalOpen] = useState(false);
  
  // 스크롤 참조
  const containerRef = useRef<HTMLDivElement>(null);
  const currentWeekRef = useRef<HTMLDivElement>(null);
  const prevWeekRef = useRef<HTMLDivElement>(null);
  const nextWeekRef = useRef<HTMLDivElement>(null);
  
  // 현재 2주 기간의 시작 날짜 (이번 주 월요일부터 시작)
  const [currentPeriodStart, setCurrentPeriodStart] = useState(() => {
    const { startDate } = getCurrentTwoWeekRange();
    return startDate;
  });
  
  // 4주간의 날짜 계산 (이전 1주 + 현재 2주 + 다음 1주)
  const { allDates, currentDates, startDateStr, endDateStr, weekStartDates } = useMemo(() => {
    const currentDates = getTwoWeekDates(currentPeriodStart);
    
    // 이전 1주 (7일)
    const prevWeekStart = new Date(currentPeriodStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(prevWeekStart);
      date.setDate(date.getDate() + i);
      prevWeekDates.push(formatDate(date));
    }
    
    // 다음 1주 (7일)
    const nextWeekStart = new Date(currentPeriodStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 14);
    const nextWeekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(nextWeekStart);
      date.setDate(date.getDate() + i);
      nextWeekDates.push(formatDate(date));
    }
    
    // 전체 날짜 배열
    const allDates = [...prevWeekDates, ...currentDates, ...nextWeekDates];
    
    // 각 주차의 시작날짜 (월요일) 계산
    const weekStartDates = [
      formatDate(prevWeekStart), // 이전 주
      formatDate(currentPeriodStart), // 현재 첫째 주  
      formatDate(new Date(currentPeriodStart.getTime() + 7 * 24 * 60 * 60 * 1000)), // 현재 둘째 주
      formatDate(nextWeekStart) // 다음 주
    ];
    
    const { startDate, endDate } = getTwoWeekRangeFromDate(currentPeriodStart);
    
    return {
      allDates,
      currentDates,
      startDateStr: formatDate(startDate),
      endDateStr: formatDate(endDate),
      weekStartDates
    };
  }, [currentPeriodStart]);

  // Supabase에서 데이터 로드
  useEffect(() => {
    let isCancelled = false;
    
    const loadData = async () => {
      try {
        setError(null);
        setIsLoading(true);
        
        console.log('📊 DB에서 데이터 로드 시작:', startDateStr, '~', endDateStr);
        
        // 식사 데이터 로드
        const mealsData = await mealService.getMealsByDateRange(startDateStr, endDateStr);
        
        // 주간 메모 데이터 로드
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
        
        if (!isCancelled) {
          setMeals(mealsData);
          
          // 주간 메모 상태 업데이트
          const memosMap: {[key: string]: WeeklyMemo} = {};
          memoResults.forEach(({ weekStart, memo }) => {
            if (memo) {
              memosMap[weekStart] = memo;
            }
          });
          setWeeklyMemos(memosMap);
          
          console.log('✅ 데이터 로드 완료:', mealsData.length, '개 식사,', Object.keys(memosMap).length, '개 주간 메모');
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('❌ 데이터 로드 오류:', err);
          setError('데이터를 불러오는데 실패했습니다.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    
    // cleanup function
    return () => {
      isCancelled = true;
      setIsLoading(false);
    };
  }, [startDateStr, endDateStr, weekStartDates]); // 주간 메모를 위한 의존성 추가

  // 네비게이션 핸들러 (역동적 스크롤 애니메이션)
  const handlePreviousPeriod = () => {
    // 1단계: 위쪽으로 슝! 스크롤
    prevWeekRef.current?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    
    // 2단계: 스크롤 완료 후 데이터 업데이트
    setTimeout(() => {
      const previousStart = getPreviousTwoWeekStart(currentPeriodStart);
      setCurrentPeriodStart(previousStart);
      
      // 3단계: 새 데이터로 현재 주 위치로 스크롤 (헤더 아래 여백 확보)
      setTimeout(() => {
        if (currentWeekRef.current) {
          const headerHeight = 120; // 헤더 높이 + 여백
          const elementPosition = currentWeekRef.current.offsetTop - headerHeight;
          window.scrollTo({ 
            top: elementPosition, 
            behavior: 'smooth' 
          });
        }
      }, 50);
    }, 400); // 스크롤 애니메이션 시간
  };

  const handleNextPeriod = () => {
    // 1단계: 아래쪽으로 슝! 스크롤
    nextWeekRef.current?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    
    // 2단계: 스크롤 완료 후 데이터 업데이트
    setTimeout(() => {
      const nextStart = getNextTwoWeekStart(currentPeriodStart);
      setCurrentPeriodStart(nextStart);
      
      // 3단계: 새 데이터로 현재 주 위치로 스크롤 (헤더 아래 여백 확보)
      setTimeout(() => {
        if (currentWeekRef.current) {
          const headerHeight = 120; // 헤더 높이 + 여백
          const elementPosition = currentWeekRef.current.offsetTop - headerHeight;
          window.scrollTo({ 
            top: elementPosition, 
            behavior: 'smooth' 
          });
        }
      }, 50);
    }, 400); // 스크롤 애니메이션 시간
  };

  const handleToday = () => {
    const { startDate } = getCurrentTwoWeekRange();
    setCurrentPeriodStart(startDate);
    
    // 스크롤 애니메이션 - 헤더 아래 여백 확보
    setTimeout(() => {
      if (currentWeekRef.current) {
        const headerHeight = 120; // 헤더 높이 + 여백
        const elementPosition = currentWeekRef.current.offsetTop - headerHeight;
        window.scrollTo({ 
          top: elementPosition, 
          behavior: 'smooth' 
        });
      }
    }, 100);
  };
  
  // 컴포넌트 마운트시 현재 주로 자동 스크롤 (헤더 아래 여백 확보)
  useEffect(() => {
    if (currentWeekRef.current) {
      const headerHeight = 120; // 헤더 높이 + 여백
      const elementPosition = currentWeekRef.current.offsetTop - headerHeight;
      window.scrollTo({ 
        top: Math.max(0, elementPosition), 
        behavior: 'instant' 
      });
    }
  }, []);

  // 식사 추가/편집 핸들러
  const handleMealClick = (date: string, mealType: MealType) => {
    setSelectedMeal({ date, mealType });
    setIsModalOpen(true);
  };

  // 식사 저장 핸들러 (DB에 실제 저장)
  const handleMealSave = async (mealData: { memo: string }) => {
    if (!selectedMeal) return;

    try {
      setError(null);
      
      const meal: Omit<Meal, 'id' | 'created_at' | 'updated_at'> = {
        date: selectedMeal.date,
        meal_type: selectedMeal.mealType,
        memo: mealData.memo
      };

      console.log('📝 DB에 식사 저장:', meal);
      
      // Supabase에 실제 저장
      const savedMeal = await mealService.upsertMeal(meal);
      console.log('✅ 저장 완료:', savedMeal);
      
      // 로컬 상태 업데이트
      setMeals(prev => {
        const existingIndex = prev.findIndex(m => 
          m.date === selectedMeal.date && m.meal_type === selectedMeal.mealType
        );
        
        if (existingIndex >= 0) {
          // 기존 식사 업데이트
          const updated = [...prev];
          updated[existingIndex] = savedMeal;
          return updated;
        } else {
          // 새 식사 추가
          return [...prev, savedMeal];
        }
      });

      setIsModalOpen(false);
      setSelectedMeal(null);
    } catch (err) {
      console.error('❌ 식사 저장 오류:', err);
      setError('식사를 저장하는데 실패했습니다.');
    }
  };

  // 특정 날짜와 식사 타입의 데이터 찾기
  const getMealByDateAndType = (date: string, mealType: MealType): Meal | undefined => {
    return meals.find(meal => meal.date === date && meal.meal_type === mealType);
  };
  
  // 날짜가 현재 데이터 로드 범위에 있는지 확인
  const isDateInDataRange = (date: string): boolean => {
    return currentDates.includes(date);
  };

  // 주간 메모 클릭 핸들러
  const handleWeeklyMemoClick = (weekStartDate: string) => {
    setSelectedWeeklyMemo(weekStartDate);
    setIsWeeklyMemoModalOpen(true);
  };

  // 주간 메모 저장 핸들러
  const handleWeeklyMemoSave = async (weekStartDate: string, memo: string) => {
    try {
      setError(null);
      
      const weeklyMemo = {
        week_start_date: weekStartDate,
        memo: memo
      };

      console.log('📝 주간 메모 저장:', weeklyMemo);
      
      const savedMemo = await weeklyMemoService.upsertWeeklyMemo(weeklyMemo);
      console.log('✅ 주간 메모 저장 완료:', savedMemo);
      
      // 로컬 상태 업데이트
      setWeeklyMemos(prev => ({
        ...prev,
        [weekStartDate]: savedMemo
      }));

      setIsWeeklyMemoModalOpen(false);
      setSelectedWeeklyMemo(null);
    } catch (err) {
      console.error('❌ 주간 메모 저장 오류:', err);
      setError('주간 메모를 저장하는데 실패했습니다.');
    }
  };

  // 주간 메모 삭제 핸들러  
  const handleWeeklyMemoDelete = async (weekStartDate: string) => {
    const memo = weeklyMemos[weekStartDate];
    if (!memo?.id) return;

    try {
      setError(null);
      console.log('🗑️ 주간 메모 삭제:', memo.id);
      
      await weeklyMemoService.deleteWeeklyMemo(memo.id);
      console.log('✅ 주간 메모 삭제 완료');
      
      // 로컬 상태에서 삭제
      setWeeklyMemos(prev => {
        const updated = { ...prev };
        delete updated[weekStartDate];
        return updated;
      });
      
      setIsWeeklyMemoModalOpen(false);
      setSelectedWeeklyMemo(null);
    } catch (err) {
      console.error('❌ 주간 메모 삭제 오류:', err);
      setError('주간 메모를 삭제하는데 실패했습니다.');
    }
  };

  // 식사 삭제 핸들러 (임시로 로컬에서만 삭제)
  const handleMealDelete = async (mealId: string) => {
    try {
      setError(null);
      console.log('🗑️ DB에서 식사 삭제:', mealId);
      
      // Supabase에서 실제 삭제
      await mealService.deleteMeal(mealId);
      console.log('✅ 삭제 완료');
      
      // 로컬 상태에서 삭제
      setMeals(prev => prev.filter(meal => meal.id !== mealId));
      
      setIsModalOpen(false);
      setSelectedMeal(null);
    } catch (err) {
      console.error('❌ 식사 삭제 오류:', err);
      setError('식사를 삭제하는데 실패했습니다.');
    }
  };

  // 현재 선택된 식사 데이터
  const currentMealData = selectedMeal ? (getMealByDateAndType(selectedMeal.date, selectedMeal.mealType) || null) : null;

  // 에러 상태  
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3">❌</div>
          <div className="text-base text-foreground mb-1">오류 발생</div>
          <div className="text-xs text-foreground/60 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm hover:opacity-90 transition-opacity"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  // 헤더 글래스모피즘 스타일 (라이트/다크 모드 모두)
  const headerGlassStyle = theme === 'light' ? {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(4.5px)',
    WebkitBackdropFilter: 'blur(4.5px)',
    boxShadow: '0 8px 32px 0 rgba(251, 146, 60, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderTop: 'none'
  } : {
    background: 'rgba(17, 24, 39, 0.8)',
    backdropFilter: 'blur(4.5px)',
    WebkitBackdropFilter: 'blur(4.5px)',
    boxShadow: '0 8px 32px 0 rgba(6, 182, 212, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(55, 65, 81, 0.3)',
    borderTop: 'none'
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 애플 캘린더 스타일 헤더 */}
      <div 
        className="border-b sticky top-0 z-50" // 모든 테마에서 글래스 효과 사용
        style={headerGlassStyle}
      >
        <div className="px-3 py-2">
          {/* 상단 컨트롤 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <button 
                onClick={handleToday}
                className="px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 relative overflow-hidden"
                style={{
                  background: theme === 'light' 
                    ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.15))'
                    : 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.2), rgba(59, 130, 246, 0.2))',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  border: theme === 'light' 
                    ? '1px solid rgba(251, 146, 60, 0.3)'
                    : '1px solid rgba(6, 182, 212, 0.4)',
                  boxShadow: theme === 'light'
                    ? '0 4px 15px rgba(251, 146, 60, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                    : '0 4px 15px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  color: theme === 'light' ? '#ea580c' : '#22d3ee'
                }}
              >
                <span className="relative z-10">오늘</span>
                {/* 글리터 효과 */}
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: theme === 'light'
                      ? 'radial-gradient(circle at 20% 80%, rgba(251, 146, 60, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.1) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)'
                      : 'radial-gradient(circle at 20% 80%, rgba(6, 182, 212, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(14, 165, 233, 0.15) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)'
                  }}
                />
              </button>
            </div>
            
            {/* 테마 토글 버튼 */}
            <button
              onClick={toggleTheme}
              className="p-1.5 text-foreground/60 hover:text-foreground transition-colors rounded-full hover:bg-secondary"
              title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          {/* 기간 표시 */}
          <div className="text-center relative">
            <div className="text-lg font-semibold text-foreground">
              {currentPeriodStart.getFullYear()}년 {currentPeriodStart.getMonth() + 1}월
            </div>
            <div className="text-xs text-foreground/60 flex items-center justify-center">
              {startDateStr} ~ {endDateStr}
              {isLoading && (
                <div className="ml-2 flex items-center">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    theme === 'light' ? 'bg-orange-500' : 'bg-cyan-500'
                  }`}></div>
                  <div className={`w-2 h-2 rounded-full animate-pulse ml-1 ${
                    theme === 'light' ? 'bg-orange-400' : 'bg-cyan-400'
                  }`} style={{ animationDelay: '0.2s' }}></div>
                  <div className={`w-2 h-2 rounded-full animate-pulse ml-1 ${
                    theme === 'light' ? 'bg-orange-300' : 'bg-cyan-300'
                  }`} style={{ animationDelay: '0.4s' }}></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 플로팅 네비게이션 버튼들 */}
      <div className="fixed right-4 bottom-16 flex flex-col space-y-3 z-40">
        {/* 위 화살표 - 이전 기간 */}
        <button
          onClick={handlePreviousPeriod}
          className="w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center group"
          style={{
            background: theme === 'light'
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(17, 24, 39, 0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: theme === 'light' 
              ? '1px solid rgba(255, 255, 255, 0.5)'
              : '1px solid rgba(55, 65, 81, 0.5)',
            boxShadow: theme === 'light'
              ? '0 8px 25px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
              : '0 8px 25px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          <svg 
            className="w-6 h-6 text-foreground/70 group-hover:text-foreground transition-colors" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* 아래 화살표 - 다음 기간 */}
        <button
          onClick={handleNextPeriod}
          className="w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center group"
          style={{
            background: theme === 'light'
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(17, 24, 39, 0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: theme === 'light' 
              ? '1px solid rgba(255, 255, 255, 0.5)'
              : '1px solid rgba(55, 65, 81, 0.5)',
            boxShadow: theme === 'light'
              ? '0 8px 25px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
              : '0 8px 25px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          <svg 
            className="w-6 h-6 text-foreground/70 group-hover:text-foreground transition-colors" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 애플 캘린더 스타일 그리드 */}
      <div className="p-2 pt-4" ref={containerRef}>

        {/* 날짜 그리드 - 데스크탑 (4주분) */}
        <div className="hidden min-[451px]:block space-y-1">
          {/* 이전 주 (빈 박스) - 위쪽 스크롤 타겟 */}
          <div className="grid grid-cols-8 gap-1 opacity-60" ref={prevWeekRef}>
            {allDates.slice(0, 7).map((date) => (
              <DayCell 
                key={date} 
                date={date} 
                meals={[]}
                onMealClick={handleMealClick}
                isEmpty={true}
                theme={theme}
              />
            ))}
            {/* 일요일 바로 옆 주간 메모 */}
            <WeeklyMemoCell
              weekStartDate={weekStartDates[0]} // 이전 주
              memo={weeklyMemos[weekStartDates[0]]}
              onClick={handleWeeklyMemoClick}
              theme={theme}
              isEmpty={true}
            />
          </div>
          
          {/* 현재 첫째 주 - 메인 스크롤 타겟 */}
          <div className="grid grid-cols-8 gap-1" ref={currentWeekRef}>
            {allDates.slice(7, 14).map((date) => (
              <DayCell 
                key={date} 
                date={date} 
                meals={isDateInDataRange(date) ? meals.filter(m => m.date === date) : []}
                onMealClick={handleMealClick}
                isEmpty={!isDateInDataRange(date)}
                theme={theme}
              />
            ))}
            {/* 일요일 바로 옆 주간 메모 */}
            <WeeklyMemoCell
              weekStartDate={weekStartDates[1]} // 현재 첫째 주
              memo={weeklyMemos[weekStartDates[1]]}
              onClick={handleWeeklyMemoClick}
              theme={theme}
            />
          </div>
          
          {/* 현재 둘째 주 */}
          <div className="grid grid-cols-8 gap-1">
            {allDates.slice(14, 21).map((date) => (
              <DayCell 
                key={date} 
                date={date} 
                meals={isDateInDataRange(date) ? meals.filter(m => m.date === date) : []}
                onMealClick={handleMealClick}
                isEmpty={!isDateInDataRange(date)}
                theme={theme}
              />
            ))}
            {/* 일요일 바로 옆 주간 메모 */}
            <WeeklyMemoCell
              weekStartDate={weekStartDates[2]} // 현재 둘째 주
              memo={weeklyMemos[weekStartDates[2]]}
              onClick={handleWeeklyMemoClick}
              theme={theme}
            />
          </div>
          
          {/* 다음 주 (빈 박스) - 아래쪽 스크롤 타겟 */}
          <div className="grid grid-cols-8 gap-1 opacity-60" ref={nextWeekRef}>
            {allDates.slice(21, 28).map((date) => (
              <DayCell 
                key={date} 
                date={date} 
                meals={[]}
                onMealClick={handleMealClick}
                isEmpty={true}
                theme={theme}
              />
            ))}
            {/* 일요일 바로 옆 주간 메모 */}
            <WeeklyMemoCell
              weekStartDate={weekStartDates[3]} // 다음 주
              memo={weeklyMemos[weekStartDates[3]]}
              onClick={handleWeeklyMemoClick}
              theme={theme}
              isEmpty={true}
            />
          </div>
        </div>

        {/* 날짜 그리드 - 모바일 (4주분, 월~목/금~일 분할) */}
        <div className="block min-[451px]:hidden space-y-2">
          {/* 이전 주 (빈 박스) - 위쪽 스크롤 타겟 */}
          <div className="space-y-1 opacity-60" ref={prevWeekRef}>
            {/* 월~목 */}
            <div className="grid grid-cols-4 gap-1">
              {allDates.slice(0, 4).map((date) => (
                <DayCell 
                  key={date} 
                  date={date} 
                  meals={[]}
                  onMealClick={handleMealClick}
                  isEmpty={true}
                  theme={theme}
                />
              ))}
            </div>
            {/* 금~일 + 주간 메모 */}
            <div className="grid grid-cols-4 gap-1">
              {allDates.slice(4, 7).map((date) => (
                <DayCell 
                  key={date} 
                  date={date} 
                  meals={[]}
                  onMealClick={handleMealClick}
                  isEmpty={true}
                  theme={theme}
                />
              ))}
              {/* 주간 메모 컴포넌트 */}
              <WeeklyMemoCell
                weekStartDate={weekStartDates[0]} // 이전 주
                memo={weeklyMemos[weekStartDates[0]]}
                onClick={handleWeeklyMemoClick}
                theme={theme}
                isEmpty={true}
              />
            </div>
          </div>
          
          {/* 현재 첫째 주 - 메인 스크롤 타겟 */}
          <div className="space-y-1" ref={currentWeekRef}>
            {/* 월~목 */}
            <div className="grid grid-cols-4 gap-1">
              {allDates.slice(7, 11).map((date) => (
                <DayCell 
                  key={date} 
                  date={date} 
                  meals={isDateInDataRange(date) ? meals.filter(m => m.date === date) : []}
                  onMealClick={handleMealClick}
                  isEmpty={!isDateInDataRange(date)}
                  theme={theme}
                />
              ))}
            </div>
            {/* 금~일 + 주간 메모 */}
            <div className="grid grid-cols-4 gap-1">
              {allDates.slice(11, 14).map((date) => (
                <DayCell 
                  key={date} 
                  date={date} 
                  meals={isDateInDataRange(date) ? meals.filter(m => m.date === date) : []}
                  onMealClick={handleMealClick}
                  isEmpty={!isDateInDataRange(date)}
                  theme={theme}
                />
              ))}
              {/* 주간 메모 컴포넌트 */}
              <WeeklyMemoCell
                weekStartDate={weekStartDates[1]} // 현재 첫째 주
                memo={weeklyMemos[weekStartDates[1]]}
                onClick={handleWeeklyMemoClick}
                theme={theme}
              />
            </div>
          </div>
          
          {/* 현재 둘째 주 */}
          <div className="space-y-1">
            {/* 월~목 */}
            <div className="grid grid-cols-4 gap-1">
              {allDates.slice(14, 18).map((date) => (
                <DayCell 
                  key={date} 
                  date={date} 
                  meals={isDateInDataRange(date) ? meals.filter(m => m.date === date) : []}
                  onMealClick={handleMealClick}
                  isEmpty={!isDateInDataRange(date)}
                  theme={theme}
                />
              ))}
            </div>
            {/* 금~일 + 빈 공간 */}
            <div className="grid grid-cols-4 gap-1">
              {allDates.slice(18, 21).map((date) => (
                <DayCell 
                  key={date} 
                  date={date} 
                  meals={isDateInDataRange(date) ? meals.filter(m => m.date === date) : []}
                  onMealClick={handleMealClick}
                  isEmpty={!isDateInDataRange(date)}
                  theme={theme}
                />
              ))}
              {/* 주간 메모 컴포넌트 */}
              <WeeklyMemoCell
                weekStartDate={weekStartDates[2]} // 현재 둘째 주  
                memo={weeklyMemos[weekStartDates[2]]}
                onClick={handleWeeklyMemoClick}
                theme={theme}
              />
            </div>
          </div>
          
          {/* 다음 주 (빈 박스) - 아래쪽 스크롤 타겟 */}
          <div className="space-y-1 opacity-60" ref={nextWeekRef}>
            {/* 월~목 */}
            <div className="grid grid-cols-4 gap-1">
              {allDates.slice(21, 25).map((date) => (
                <DayCell 
                  key={date} 
                  date={date} 
                  meals={[]}
                  onMealClick={handleMealClick}
                  isEmpty={true}
                  theme={theme}
                />
              ))}
            </div>
            {/* 금~일 + 빈 공간 */}
            <div className="grid grid-cols-4 gap-1">
              {allDates.slice(25, 28).map((date) => (
                <DayCell 
                  key={date} 
                  date={date} 
                  meals={[]}
                  onMealClick={handleMealClick}
                  isEmpty={true}
                  theme={theme}
                />
              ))}
              {/* 주간 메모 컴포넌트 */}
              <WeeklyMemoCell
                weekStartDate={weekStartDates[3]} // 다음 주
                memo={weeklyMemos[weekStartDates[3]]}
                onClick={handleWeeklyMemoClick}
                theme={theme}
                isEmpty={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 식사 추가/편집 모달 */}
      {isModalOpen && selectedMeal && (
        <MealModal
          date={selectedMeal.date}
          mealType={selectedMeal.mealType}
          mealData={currentMealData}
          onSave={handleMealSave}
          onDelete={currentMealData?.id ? () => handleMealDelete(currentMealData.id!) : undefined}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMeal(null);
          }}
        />
      )}

      {/* 주간 메모 추가/편집 모달 */}
      {isWeeklyMemoModalOpen && selectedWeeklyMemo && (
        <WeeklyMemoModal
          weekStartDate={selectedWeeklyMemo}
          memoData={weeklyMemos[selectedWeeklyMemo]}
          onSave={handleWeeklyMemoSave}
          onDelete={weeklyMemos[selectedWeeklyMemo]?.id ? () => handleWeeklyMemoDelete(selectedWeeklyMemo) : undefined}
          onClose={() => {
            setIsWeeklyMemoModalOpen(false);
            setSelectedWeeklyMemo(null);
          }}
          theme={theme}
        />
      )}
    </div>
  );
}

// 주간 메모 셀 컴포넌트
function WeeklyMemoCell({
  weekStartDate,
  memo,
  onClick,
  theme,
  isEmpty = false
}: {
  weekStartDate: string;
  memo?: WeeklyMemo;
  onClick: (weekStartDate: string) => void;
  theme: 'light' | 'dark';
  isEmpty?: boolean;
}) {
  const weekStartObj = new Date(weekStartDate);
  const weekEndObj = new Date(weekStartObj);
  weekEndObj.setDate(weekEndObj.getDate() + 6);
  
  const weekRange = `${weekStartObj.getMonth() + 1}/${weekStartObj.getDate()}-${weekEndObj.getDate()}`;


  return (
    <button
      onClick={() => onClick(weekStartDate)}
      className={`${
        isEmpty 
          ? 'bg-card/30 border border-border/30 opacity-60' 
          : 'bg-card border border-border hover:bg-card/80'
      } rounded-lg min-h-[100px] p-1.5 transition-all duration-300 hover:scale-[1.02] text-left`}
      style={isEmpty ? {} : {
        background: theme === 'light'
          ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.03), rgba(245, 158, 11, 0.03), rgba(251, 191, 36, 0.03))'
          : 'linear-gradient(135deg, rgba(6, 182, 212, 0.03), rgba(14, 165, 233, 0.03), rgba(59, 130, 246, 0.03))',
        borderColor: theme === 'light' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(6, 182, 212, 0.2)'
      }}
    >
      {/* 주간 표시 */}
      <div className="text-center mb-2">
        <div className={`text-[10px] font-medium ${
          theme === 'light' ? 'text-orange-600' : 'text-cyan-500'
        }`}>
          memo
        </div>
        <div className="text-[10px] text-foreground/60 mt-0.5">
          {weekRange}
        </div>
      </div>

      {/* 메모 내용 */}
      <div className="space-y-1">
        {memo ? (
          <div 
            className="text-[10px] text-foreground/80 leading-relaxed overflow-hidden"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {memo.memo}
          </div>
        ) : (
          <div className="text-[10px] text-foreground/40 text-center py-2">
            {isEmpty ? '메모 없음' : '메모 추가'}
          </div>
        )}
      </div>
    </button>
  );
}

// 주간 메모 모달 컴포넌트
function WeeklyMemoModal({
  weekStartDate,
  memoData,
  onSave,
  onDelete,
  onClose,
  theme
}: {
  weekStartDate: string;
  memoData?: WeeklyMemo;
  onSave: (weekStartDate: string, memo: string) => void;
  onDelete?: () => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}) {
  const [memo, setMemo] = useState(memoData?.memo || '');

  const weekStartObj = new Date(weekStartDate);
  const weekEndObj = new Date(weekStartObj);
  weekEndObj.setDate(weekEndObj.getDate() + 6);
  const weekRange = `${weekStartObj.getMonth() + 1}월 ${weekStartObj.getDate()}일 ~ ${weekEndObj.getDate()}일`;

  const handleSave = () => {
    if (!memo.trim()) return;
    onSave(weekStartDate, memo);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <div 
        className="bg-card w-full max-h-[80vh] rounded-t-xl border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">
              📝 주간 메모 {memoData ? '편집' : '추가'}
            </h2>
            <p className="text-xs text-card-foreground/60 mt-0.5">{weekRange}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-secondary rounded-full transition-colors"
          >
            <svg className="w-4 h-4 text-card-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 모달 내용 */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[50vh]">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              주간 메모 *
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="사랑을 담은 메모를 적어보세용 🩷"
              rows={6}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-card-foreground placeholder-card-foreground/50 focus:ring-1 focus:ring-ring focus:border-ring outline-none resize-none text-base"
            />
          </div>

          {/* 삭제 버튼 (편집 시에만) */}
          {memoData && onDelete && (
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => {
                  if (confirm('이 주간 메모를 삭제하시겠습니까?')) {
                    onDelete();
                  }
                }}
                className="px-3 py-1.5 text-sm text-red-600 bg-red-500/10 hover:bg-red-500/20 hover:text-red-700 transition-all duration-200 rounded-md border border-red-500/20 hover:border-red-500/30"
              >
                🗑️ 삭제하기
              </button>
            </div>
          )}
        </div>

        {/* 모달 하단 버튼 */}
        <div className="p-4 border-t border-border flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-border rounded-lg font-medium text-card-foreground hover:bg-secondary transition-colors text-sm"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!memo.trim()}
            className="flex-1 py-2.5 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            style={{
              background: theme === 'light'
                ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.9), rgba(245, 158, 11, 0.9))'
                : 'linear-gradient(135deg, rgba(6, 182, 212, 0.9), rgba(14, 165, 233, 0.9))',
              color: 'white'
            }}
          >
            {memoData ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 애플 캘린더 스타일 날짜 셀 컴포넌트
function DayCell({ 
  date, 
  meals, 
  onMealClick,
  isEmpty = false,
  theme
}: {
  date: string;
  meals: Meal[];
  onMealClick: (date: string, mealType: MealType) => void;
  isEmpty?: boolean;
  theme: 'light' | 'dark';
}) {
  const dateObj = new Date(date);
  const dayNumber = dateObj.getDate();
  const today = new Date();
  const isToday = formatDate(dateObj) === formatDate(today);
  
  // 요일 계산 (0: 일요일, 1: 월요일, ..., 6: 토요일)
  const dayOfWeek = dateObj.getDay();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[dayOfWeek];

  // 오늘 날짜 스타일 
  const todayStyle = isToday ? (
    theme === 'light' ? {
      background: isEmpty 
        ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.05), rgba(245, 158, 11, 0.05), rgba(251, 191, 36, 0.05))'
        : 'linear-gradient(135deg, rgba(251, 146, 60, 0.08), rgba(245, 158, 11, 0.08), rgba(251, 191, 36, 0.08))',
      boxShadow: '0 0 0 1px rgba(251, 146, 60, 0.3), 0 0 20px rgba(251, 146, 60, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(251, 146, 60, 0.2)'
    } : {
      background: isEmpty 
        ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.05), rgba(14, 165, 233, 0.05), rgba(59, 130, 246, 0.05))'
        : 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(14, 165, 233, 0.08), rgba(59, 130, 246, 0.08))',
      boxShadow: '0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(6, 182, 212, 0.2)'
    }
  ) : {};

  return (
    <div 
      className={`${
        isEmpty 
          ? 'bg-card/30 border border-border/30' // 빈 박스 스타일
          : 'bg-card border border-border hover:bg-card/80' // 일반 스타일
      } rounded-lg min-h-[100px] p-1.5 transition-all duration-300 ${
        isToday ? 'relative overflow-hidden' : ''
      }`}
      style={todayStyle}
    >
      {/* 오늘 글리터 효과 */}
      {isToday && (
        <div 
          className="absolute inset-0 opacity-20 rounded-lg"
          style={{
            background: theme === 'light'
              ? 'radial-gradient(circle at 30% 20%, rgba(251, 146, 60, 0.1) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(245, 158, 11, 0.1) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)'
              : 'radial-gradient(circle at 30% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(14, 165, 233, 0.1) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)'
          }}
        />
      )}

      {/* 날짜 숫자와 요일 */}
      <div className={`text-center mb-1.5 relative z-10 ${
        isToday ? 'font-semibold' : 'text-foreground'
      }`}>
        <span 
          className={`text-sm ${
            isToday 
              ? (theme === 'light'
                  ? 'bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 bg-clip-text text-transparent font-bold'
                  : 'bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500 bg-clip-text text-transparent font-bold')
              : ''
          }`}
        >
          {dayNumber}
        </span>
        <span className={`text-xs ml-1 ${
          isToday 
            ? (theme === 'light' ? 'text-orange-500' : 'text-cyan-400') // 오늘은 테마별 색상
            : dayOfWeek === 0 ? 'text-red-500 dark:text-red-400' // 일요일 - 빨간색
            : dayOfWeek === 6 ? 'text-blue-500 dark:text-blue-400' // 토요일 - 파란색  
            : 'text-foreground/40' // 평일 - 옅은색
        }`}>
          ({dayName})
        </span>
      </div>

      {/* 식사 아이템들 - 기타가 맨 위에 오도록 정렬 */}
      <div className="space-y-0.5">
        {/* '기타' 타입을 맨 위로, 나머지는 기본 순서 (breakfast, lunch, dinner) */}
        {[...meals]
          .sort((a, b) => {
            // 기타를 맨 위로
            if (a.meal_type === 'other' && b.meal_type !== 'other') return -1;
            if (a.meal_type !== 'other' && b.meal_type === 'other') return 1;
            
            // 나머지는 기본 순서 유지
            const order = ['breakfast', 'lunch', 'dinner', 'other'];
            return order.indexOf(a.meal_type) - order.indexOf(b.meal_type);
          })
          .map(meal => {
            const mealInfo = MEAL_INFO[meal.meal_type];
            const isOther = meal.meal_type === 'other';
            
            // 기타 타입은 두 줄까지, 나머지는 한 줄만
            const displayText = isOther 
              ? meal.memo.split('\n').slice(0, 2).join('\n')
              : meal.memo.split('\n')[0];
            
            return (
              <button
                key={meal.meal_type}
                onClick={() => onMealClick(date, meal.meal_type)}
                className={`w-full text-left p-1 rounded text-xs transition-all active:scale-95 hover:opacity-80 ${mealInfo.color}`}
              >
                <span 
                  className="font-medium leading-tight overflow-hidden"
                  style={isOther ? {
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  } : {
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {displayText}
                </span>
              </button>
            );
          })}
        
        {/* 추가 드롭다운 - 빈 박스가 아니고 식사가 4개 미만일 때만 */}
        {!isEmpty && meals.length < 4 && (
          <MealTypeDropdown 
            date={date}
            existingTypes={meals.map(m => m.meal_type)}
            onSelect={onMealClick}
          />
        )}
      </div>


    </div>
  );
}

// 식사 추가/편집 모달 컴포넌트
function MealModal({ 
  date, 
  mealType, 
  mealData, 
  onSave, 
  onDelete,
  onClose 
}: {
  date: string;
  mealType: MealType;
  mealData: Meal | null;
  onSave: (data: { memo: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [memo, setMemo] = useState(mealData?.memo || '');

  const mealInfo = MEAL_INFO[mealType];
  const dateStr = formatDateKorean(new Date(date));

  const handleSave = () => {
    if (!memo.trim()) return;
    onSave({ memo });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <div 
        className="bg-card w-full max-h-[80vh] rounded-t-xl border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">
              {mealInfo.title} {mealData ? '편집' : '추가'}
            </h2>
            <p className="text-xs text-card-foreground/60 mt-0.5">{dateStr}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-secondary rounded-full transition-colors"
          >
            <svg className="w-4 h-4 text-card-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 모달 내용 */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[50vh]">
          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              메모 *
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={`예: 김치찌개 🍲\n돼지고기와 김치로 끓인 찌개\n\n메뉴와 설명을 자유롭게 작성하세요!`}
              rows={5}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-card-foreground placeholder-card-foreground/50 focus:ring-1 focus:ring-ring focus:border-ring outline-none resize-none text-base"
            />
          </div>

          {/* 삭제 버튼 (편집 시에만) */}
          {mealData && onDelete && (
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => {
                  if (confirm('이 식사를 삭제하시겠습니까?')) {
                    onDelete();
                  }
                }}
                className="px-3 py-1.5 text-sm text-red-600 bg-red-500/10 hover:bg-red-500/20 hover:text-red-700 transition-all duration-200 rounded-md border border-red-500/20 hover:border-red-500/30"
              >
                🗑️ 삭제하기
              </button>
            </div>
          )}
        </div>

        {/* 모달 하단 버튼 */}
        <div className="p-4 border-t border-border flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-border rounded-lg font-medium text-card-foreground hover:bg-secondary transition-colors text-sm"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!memo.trim()}
            className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity text-sm"
          >
            {mealData ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 식사 타입 선택 드롭다운 컴포넌트
function MealTypeDropdown({
  date,
  existingTypes,
  onSelect
}: {
  date: string;
  existingTypes: MealType[];
  onSelect: (date: string, mealType: MealType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 사용 가능한 식사 타입
  const availableTypes = [
    { type: 'breakfast' as const, info: MEAL_INFO.breakfast },
    { type: 'lunch' as const, info: MEAL_INFO.lunch },
    { type: 'dinner' as const, info: MEAL_INFO.dinner },
    { type: 'other' as const, info: MEAL_INFO.other },
  ].filter(item => !existingTypes.includes(item.type));

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (mealType: MealType) => {
    onSelect(date, mealType);
    setIsOpen(false);
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      {/* 추가 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-1 rounded text-xs transition-all active:scale-95 hover:bg-secondary/50 border border-dashed border-border/50 relative"
      >
        <div className="flex items-center justify-between space-x-1">
          <div className="flex items-center space-x-1">
             <span className="text-foreground/30 text-[10px] whitespace-nowrap">추가</span>
          </div>
          <svg 
            className={`w-2 h-2 text-foreground/30 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && availableTypes.length > 0 && (
        <div className="absolute top-full left-0 w-full min-w-[130px] bg-card border border-border rounded-md shadow-lg z-40 mt-1 backdrop-blur-none">
          {availableTypes.map(({ type, info }) => (
            <button
              key={type}
              onClick={() => handleSelect(type)}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary transition-colors first:rounded-t-md last:rounded-b-md"
            >
              <span className="text-card-foreground">{info.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
