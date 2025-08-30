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
import { mealService, type Meal } from '@/lib/supabase';

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
  const [meals, setMeals] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<{date: string, mealType: MealType} | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 현재 2주 기간의 시작 날짜 (이번 주 월요일부터 시작)
  const [currentPeriodStart, setCurrentPeriodStart] = useState(() => {
    const { startDate } = getCurrentTwoWeekRange();
    return startDate;
  });
  
  // 현재 2주간의 날짜 계산 (useMemo로 최적화)
  const { dates, startDateStr, endDateStr } = useMemo(() => {
    const dates = getTwoWeekDates(currentPeriodStart);
    const { startDate, endDate } = getTwoWeekRangeFromDate(currentPeriodStart);
    return {
      dates,
      startDateStr: formatDate(startDate),
      endDateStr: formatDate(endDate)
    };
  }, [currentPeriodStart]);

  // Supabase에서 데이터 로드
  useEffect(() => {
    let isCancelled = false;
    
    const loadMeals = async () => {
      try {
        setError(null);
        
        console.log('📊 DB에서 데이터 로드 시작:', startDateStr, '~', endDateStr);
        
        // Supabase에서 실제 데이터 로드
        const data = await mealService.getMealsByDateRange(startDateStr, endDateStr);
        
        if (!isCancelled) {
          setMeals(data);
          console.log('✅ 데이터 로드 완료:', data.length, '개 식사');
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('❌ 식사 데이터 로드 오류:', err);
          setError('식사 데이터를 불러오는데 실패했습니다.');
        }
      }
    };

    loadMeals();
    
    // cleanup function
    return () => {
      isCancelled = true;
    };
  }, [startDateStr, endDateStr]); // 문자열로 의존성 단순화

  // 네비게이션 핸들러
  const handlePreviousPeriod = () => {
    const previousStart = getPreviousTwoWeekStart(currentPeriodStart);
    setCurrentPeriodStart(previousStart);
  };

  const handleNextPeriod = () => {
    const nextStart = getNextTwoWeekStart(currentPeriodStart);
    setCurrentPeriodStart(nextStart);
  };

  const handleToday = () => {
    const { startDate } = getCurrentTwoWeekRange();
    setCurrentPeriodStart(startDate);
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* 애플 캘린더 스타일 헤더 */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-3 py-2">
          {/* 상단 컨트롤 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleToday}
                className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
              >
                오늘
              </button>
              <button
                onClick={handlePreviousPeriod}
                className="p-1 text-foreground/60 hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleNextPeriod}
                className="p-1 text-foreground/60 hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* 기간 표시 */}
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">
              {currentPeriodStart.getFullYear()}년 {currentPeriodStart.getMonth() + 1}월
            </div>
            <div className="text-xs text-foreground/60">
              {startDateStr} ~ {endDateStr}
            </div>
          </div>
        </div>
      </div>

      {/* 애플 캘린더 스타일 그리드 */}
      <div className="p-2">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
            <div key={day} className="text-center text-xs text-foreground/60 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 - 2주분 */}
        <div className="space-y-1">
          {/* 첫째 주 */}
          <div className="grid grid-cols-7 gap-1">
            {dates.slice(0, 7).map((date) => (
              <DayCell 
                key={date} 
                date={date} 
                meals={meals.filter(m => m.date === date)}
                onMealClick={handleMealClick}
              />
            ))}
          </div>
          
          {/* 둘째 주 */}
          <div className="grid grid-cols-7 gap-1">
            {dates.slice(7, 14).map((date) => (
              <DayCell 
                key={date} 
                date={date} 
                meals={meals.filter(m => m.date === date)}
                onMealClick={handleMealClick}
              />
            ))}
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
    </div>
  );
}

// 애플 캘린더 스타일 날짜 셀 컴포넌트
function DayCell({ 
  date, 
  meals, 
  onMealClick 
}: {
  date: string;
  meals: Meal[];
  onMealClick: (date: string, mealType: MealType) => void;
}) {
  const dateObj = new Date(date);
  const dayNumber = dateObj.getDate();
  const today = new Date();
  const isToday = formatDate(dateObj) === formatDate(today);
  
  // 식사별로 그룹화
  const mealsByType = meals.reduce((acc, meal) => {
    acc[meal.meal_type] = meal;
    return acc;
  }, {} as Record<MealType, Meal>);

  return (
    <div className={`bg-card border border-border rounded-lg min-h-[100px] p-1.5 transition-colors hover:bg-card/80 ${
      isToday ? 'ring-1 ring-primary' : ''
    }`}>
      {/* 날짜 숫자 */}
      <div className={`text-center mb-1.5 ${isToday ? 'text-primary font-semibold' : 'text-foreground'}`}>
        <span className="text-sm">{dayNumber}</span>
      </div>

      {/* 식사 아이템들 - 내용이 있는 것만 표시 */}
      <div className="space-y-0.5">
        {/* 실제 데이터가 있는 식사들만 표시 */}
        {meals.map(meal => {
          const mealInfo = MEAL_INFO[meal.meal_type];
          return (
            <button
              key={meal.meal_type}
              onClick={() => onMealClick(date, meal.meal_type)}
              className={`w-full text-left p-1 rounded text-xs transition-all active:scale-95 hover:opacity-80 ${mealInfo.color}`}
            >
              <div className="flex items-center space-x-1">
                <div className={`w-1.5 h-1.5 rounded-full ${mealInfo.dotColor}`} />
                <span className="truncate font-medium">{meal.memo.split('\n')[0]}</span>
              </div>
            </button>
          );
        })}
        
        {/* 추가 드롭다운 - 아무 식사가 없거나 4개 미만일 때 */}
        {meals.length < 4 && (
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
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
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
  const availableTypes: { type: MealType; info: any }[] = [
    { type: 'breakfast', info: MEAL_INFO.breakfast },
    { type: 'lunch', info: MEAL_INFO.lunch },
    { type: 'dinner', info: MEAL_INFO.dinner },
    { type: 'other', info: MEAL_INFO.other },
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
    <div className="relative" ref={dropdownRef}>
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
        <div className="absolute top-full left-0 w-full min-w-[130px] bg-card border border-border rounded-md shadow-lg z-50 mt-1">
          {availableTypes.map(({ type, info }) => (
            <button
              key={type}
              onClick={() => handleSelect(type)}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary transition-colors flex items-center space-x-1 first:rounded-t-md last:rounded-b-md"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${info.dotColor}`} />
              <span className="text-card-foreground">{info.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
