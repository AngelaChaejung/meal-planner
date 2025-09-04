-- 주간 메모 테이블 생성
CREATE TABLE IF NOT EXISTS weekly_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start_date DATE NOT NULL, -- 해당 주의 월요일 날짜 (YYYY-MM-DD)
  memo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- 같은 주에 대해서는 하나의 메모만 존재하도록 제약
  UNIQUE(week_start_date)
);

-- 업데이트 시간 자동 갱신을 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_weekly_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language plpgsql;

-- 트리거 생성
CREATE OR REPLACE TRIGGER update_weekly_memos_updated_at
  BEFORE UPDATE ON weekly_memos
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_memos_updated_at();

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_weekly_memos_week_start_date ON weekly_memos(week_start_date);

-- RLS (Row Level Security) 설정 (필요시)
-- ALTER TABLE weekly_memos ENABLE ROW LEVEL SECURITY;
