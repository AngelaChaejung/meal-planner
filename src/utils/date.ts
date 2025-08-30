/**
 * 날짜 관련 유틸리티 함수들 (dayjs 사용)
 */
import dayjs from 'dayjs';

/**
 * Date 객체를 YYYY-MM-DD 형식의 문자열로 변환
 */
export function formatDate(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

/**
 * YYYY-MM-DD 형식의 문자열을 Date 객체로 변환
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00');
}

/**
 * 주어진 날짜가 속한 주의 시작일(월요일)을 반환
 */
export function getWeekStartDate(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // 일요일이면 -6, 아니면 1
  result.setDate(diff);
  return result;
}

/**
 * 주어진 날짜가 속한 주의 종료일(일요일)을 반환
 */
export function getWeekEndDate(date: Date): Date {
  const startDate = getWeekStartDate(date);
  const result = new Date(startDate);
  result.setDate(startDate.getDate() + 6);
  return result;
}

/**
 * 2주간의 날짜 배열을 생성
 */
export function getTwoWeekDates(startDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  
  for (let i = 0; i < 14; i++) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * 날짜를 한국어로 표시 (예: 2024년 1월 15일 (월))
 */
export function formatDateKorean(date: Date): string {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

/**
 * 오늘 날짜를 반환
 */
export function getToday(): Date {
  return new Date();
}

/**
 * 기준 날짜 (2024년 9월 2일 월요일) - 월요일부터 시작하는 2주 구간의 기준점
 */
const EPOCH_MONDAY = dayjs('2024-09-02');

/**
 * 주어진 날짜가 속한 올바른 2주 기간을 계산 (월요일부터 시작)
 * 
 * 예시: 2025년 8월 30일(토요일) → 8월 18일(월) ~ 8월 31일(일)
 *       다음 구간: 9월 1일(월) ~ 9월 14일(일)
 */
export function getFixedTwoWeekPeriod(date: Date): { startDate: Date; endDate: Date } {
  const targetDate = dayjs(date);
  
  // 기준 월요일로부터 몇 일 차이나는지 계산
  const diffDays = targetDate.diff(EPOCH_MONDAY, 'day');
  
  // 어느 2주 구간에 속하는지 계산 (0, 1, 2, ...)
  const periodIndex = Math.floor(diffDays / 14);
  
  // 해당 구간의 시작일 (월요일) 계산
  const startDate = EPOCH_MONDAY.add(periodIndex * 14, 'day');
  
  // 종료일 (일요일) 계산 - 시작일로부터 13일 후
  const endDate = startDate.add(13, 'day');
  
  console.log('🔍 월요일 기준 날짜 계산:');
  console.log('입력:', targetDate.format('YYYY-MM-DD dddd'));
  console.log('기준 월요일:', EPOCH_MONDAY.format('YYYY-MM-DD dddd'));
  console.log('일수 차이:', diffDays);
  console.log('구간 번호:', periodIndex);
  console.log('2주 구간:', startDate.format('YYYY-MM-DD dddd'), '~', endDate.format('YYYY-MM-DD dddd'));
  console.log('구간 형식:', startDate.format('M/D') + '(' + startDate.format('ddd') + ') ~ ' + endDate.format('M/D') + '(' + endDate.format('ddd') + ')');
  
  // 검증
  if (targetDate.isBefore(startDate) || targetDate.isAfter(endDate)) {
    console.error('❌ 날짜가 구간을 벗어남!');
  } else {
    console.log('✅ 올바른 월요일-일요일 2주 구간!');
  }
  
  return { 
    startDate: startDate.toDate(), 
    endDate: endDate.toDate() 
  };
}

/**
 * 다음 주 월요일부터 시작하는 2주간의 날짜 범위를 반환
 * (호환성을 위해 유지하지만 사실상 사용 안 함)
 */
export function getNextTwoWeekRange(): { startDate: Date; endDate: Date } {
  const today = getToday();
  return getFixedTwoWeekPeriod(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000));
}

/**
 * 현재 날짜가 속한 고정 2주 기간을 반환
 */
export function getCurrentTwoWeekRange(): { startDate: Date; endDate: Date } {
  const today = getToday();
  return getFixedTwoWeekPeriod(today);
}

/**
 * 주어진 날짜로부터 2주간의 날짜 범위를 반환
 */
export function getTwoWeekRangeFromDate(startDate: Date): { startDate: Date; endDate: Date } {
  return getFixedTwoWeekPeriod(startDate);
}

/**
 * 이전 2주 기간의 시작 날짜를 반환
 */
export function getPreviousTwoWeekStart(currentStart: Date): Date {
  // 현재 기간에서 하루 전으로 가서 이전 기간을 찾기
  const previousDay = new Date(currentStart);
  previousDay.setDate(currentStart.getDate() - 1);
  
  const previousPeriod = getFixedTwoWeekPeriod(previousDay);
  return previousPeriod.startDate;
}

/**
 * 다음 2주 기간의 시작 날짜를 반환  
 */
export function getNextTwoWeekStart(currentStart: Date): Date {
  // 현재 기간에서 14일 후로 가서 다음 기간을 찾기
  const nextPeriodDay = new Date(currentStart);
  nextPeriodDay.setDate(currentStart.getDate() + 14);
  
  const nextPeriod = getFixedTwoWeekPeriod(nextPeriodDay);
  return nextPeriod.startDate;
}

/**
 * 날짜가 과거인지 확인
 */
export function isPastDate(date: Date): boolean {
  const today = getToday();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate < today;
}

/**
 * 두 날짜가 같은 2주 기간에 속하는지 확인
 */
export function isSameTwoWeekPeriod(date1: Date, date2: Date): boolean {
  const period1 = getFixedTwoWeekPeriod(date1);
  const period2 = getFixedTwoWeekPeriod(date2);
  
  // 두 기간의 시작일이 같으면 같은 기간
  return period1.startDate.getTime() === period2.startDate.getTime();
}
