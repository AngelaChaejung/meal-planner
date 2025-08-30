-- 'other' meal_type 추가를 위한 Supabase 마이그레이션
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 CHECK 제약조건 확인 및 제거
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- meals 테이블의 meal_type CHECK 제약조건 이름 찾기
    SELECT conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'meals' 
    AND n.nspname = 'public' 
    AND c.contype = 'c'
    AND c.consrc LIKE '%meal_type%' OR c.conbin::text LIKE '%meal_type%';
    
    -- 제약조건이 있으면 삭제
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE meals DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END IF;
END $$;

-- 2. 새로운 CHECK 제약조건 추가 (breakfast, lunch, dinner, other)
ALTER TABLE meals 
ADD CONSTRAINT meals_meal_type_check 
CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'other'));

-- 3. 확인: 새 제약조건이 제대로 적용되었는지 테스트
-- 테스트용 데이터 삽입 (즉시 삭제됨)
DO $$
BEGIN
    -- other 타입 테스트
    INSERT INTO meals (date, meal_type, memo) VALUES (CURRENT_DATE, 'other', '테스트 기타 식사');
    DELETE FROM meals WHERE memo = '테스트 기타 식사';
    RAISE NOTICE 'SUCCESS: other meal_type is now allowed';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'ERROR: Failed to add other meal_type - %', SQLERRM;
END $$;

-- 4. 현재 제약조건 확인
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'meals'::regclass 
AND contype = 'c';

COMMIT;
