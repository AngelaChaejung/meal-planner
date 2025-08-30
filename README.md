# 🍽️ 식단 관리 앱

2주 단위로 식단을 계획하고 관리할 수 있는 웹 애플리케이션입니다.

## ✨ 주요 기능

- 📅 **2주 단위 캘린더**: 월요일부터 일요일까지 2주 구간으로 식단 관리
- 🍳 **식사 타입**: 아침, 점심, 저녁, 기타 (드롭다운으로 선택)
- 📝 **간편한 메모**: 메뉴명과 설명을 자유롭게 작성
- 📱 **모바일 최적화**: 터치 친화적인 UI와 반응형 디자인
- 🌙 **다크 모드**: 눈에 편안한 어두운 테마
- 🔄 **실시간 동기화**: Supabase를 통한 실시간 데이터 저장

## 🚀 시작하기

### 1. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 Supabase 정보를 입력하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ahtpbendqftrzbejyvcl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodHBiZW5kcWZ0cnpiZWp5dmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1MTQzMTAsImV4cCI6MjA3MjA5MDMxMH0.VQlkSKw8vHnHInBdUtQ7yposqQhexELNHS9fubJBf68
```

> **⚠️ 중요**: `.env.local` 파일은 git에 포함되지 않으므로 안전합니다.

### 2. 패키지 설치

```bash
npm install
# 또는
yarn install
# 또는
pnpm install
```

### 3. 개발 서버 실행

```bash
npm run dev
# 또는
yarn dev
# 또는
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열어 앱을 확인하세요.

## 🛠️ 기술 스택

- **Framework**: Next.js 15 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **데이터베이스**: Supabase (PostgreSQL)
- **날짜 처리**: Day.js
- **UI**: 반응형 모바일 친화적 디자인

## 📱 사용법

1. **식사 추가**: 빈 날짜 칸의 '추가' 버튼 클릭 → 식사 타입 선택
2. **메모 작성**: 메뉴명과 설명을 자유롭게 입력
3. **수정/삭제**: 기존 식사 클릭하여 편집 또는 삭제
4. **날짜 이동**: 좌우 화살표로 2주 기간 이동
5. **오늘로**: '오늘' 버튼으로 현재 날짜 구간으로 이동

## 🚀 배포

### Vercel 배포

1. **GitHub에 푸시** (`.env.local`은 자동으로 제외됨)
2. **Vercel 대시보드**에서 프로젝트 Import
3. **Environment Variables** 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy** 버튼 클릭

### 다른 플랫폼

Netlify, Railway 등에서도 동일하게 환경변수를 설정하여 배포 가능합니다.
