-- Supabase 스키마 변경 마이그레이션
-- 기존 데이터를 보존하면서 새 구조로 변경

-- 1. 기존 테이블 백업 (선택사항)
-- CREATE TABLE meals_backup AS SELECT * FROM meals;

-- 2. 새 memo 컬럼 추가
ALTER TABLE meals ADD COLUMN IF NOT EXISTS memo TEXT;

-- 3. 기존 데이터를 memo 필드로 마이그레이션
UPDATE meals 
SET memo = CASE 
  WHEN description IS NOT NULL AND description != '' 
  THEN name || E'\n' || description 
  ELSE name 
END
WHERE memo IS NULL OR memo = '';

-- 4. memo 컬럼을 NOT NULL로 변경
ALTER TABLE meals ALTER COLUMN memo SET NOT NULL;

-- 5. 불필요한 컬럼들 삭제
ALTER TABLE meals DROP COLUMN IF EXISTS name;
ALTER TABLE meals DROP COLUMN IF EXISTS description;
ALTER TABLE meals DROP COLUMN IF EXISTS images;

-- 6. 확인용 샘플 데이터 조회
-- SELECT date, meal_type, memo FROM meals ORDER BY date, meal_type;
