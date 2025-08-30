-- Supabase용 식단 관리 앱 DB 스키마

-- 1. 식사 테이블 생성 (간소화된 구조)
CREATE TABLE IF NOT EXISTS meals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'other')) NOT NULL,
  memo TEXT NOT NULL, -- 메모 필드 하나로 통합
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 같은 날, 같은 식사 타입은 하나만 허용
  UNIQUE(date, meal_type)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_meals_date_type ON meals(date, meal_type);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date, meal_type);

-- RLS (Row Level Security) 비활성화 (인증 없으므로)
ALTER TABLE meals DISABLE ROW LEVEL SECURITY;

-- 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: updated_at 자동 업데이트 (존재하지 않을 때만 생성)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_meals_updated_at') THEN
    CREATE TRIGGER update_meals_updated_at 
    BEFORE UPDATE ON meals
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END;
$$;

-- 오늘 날짜 기준 샘플 데이터 삽입
DO $$
DECLARE
  today_date DATE := CURRENT_DATE;
  tomorrow_date DATE := CURRENT_DATE + INTERVAL '1 day';
BEGIN
  -- 기존 샘플 데이터가 없을 때만 삽입
  IF NOT EXISTS (SELECT 1 FROM meals LIMIT 1) THEN
    INSERT INTO meals (date, meal_type, memo) VALUES
      (today_date, 'breakfast', '토스트와 계란 🍳\n버터 토스트와 스크램블 에그'),
      (today_date, 'lunch', '김치찌개 🍲\n돼지고기와 김치로 끓인 찌개'),
      (today_date, 'dinner', '불고기 🥩\n양념한 소고기 불고기'),
      (tomorrow_date, 'breakfast', '시리얼 🥣\n우유와 함께'),
      (tomorrow_date, 'lunch', '라면 🍜\n신라면 + 계란');
  END IF;
END;
$$;
