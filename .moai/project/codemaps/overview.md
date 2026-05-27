# Codemaps — Overview (Placeholder)

> 신규 프로젝트로 분석할 소스 코드가 아직 없습니다. 코드 구현 후 `/moai project --force` 또는 codemaps 워크플로우로 실제 아키텍처 맵(overview/modules/dependencies/entry-points/data-flow)을 생성하세요.

## 프로젝트 목표
- 언론사 기사 **제작 시스템** 구현 (수집·배부는 향후)
- 서버: NodeJS + MVC + SQLite / 클라이언트: React + Vite + MVC

## 예정 시스템 경계
- **클라이언트** (React/Vite): 로그인 · 기사 작성 · 기사 조회 페이지
- **서버** (NodeJS): 기사/사용자 함수, 인증, 기사 생애주기, SQLite 영속화
- **DB** (SQLite): Article · Contents · User 3개 테이블, 기사 ID 생성 SP

## 핵심 데이터 흐름 (예정)
로그인 → 인증 → 기사 작성 페이지 → 송고(기사 DTO) → 생애주기 상태 전이 → SQLite 반영 → 조회 페이지(실시간)
