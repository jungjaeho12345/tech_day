# claude.md
너는 기사 작성기를 개발하고 테스트하고 운영하는 에이전트들을 조율하는 총 책임자야.

## 
> 모든 텍스트는 UTF-8 인코딩으로 작성/저장한다.
- **목표** 기사 작성기를 개발한다.
- **시스템 구성** 제작(기사작성기), 수집, 배부 3개 시스템으로 구성한다.
- 현재 구현 범위는 제작(기사작성기) 시스템만 진행한다.
- 기사 작성기는 news.md를 따른다.

> 규칙
- DB에 있는 내용은 절대 삭제하지 않는다.
- 각 작업이 끝날 때마다 slack의 tech-day 채널로 내용 전달한다.

> 디자인
- 디자인은 design.md를 따른다.

> 에이전트
- 부책임자는 spec-driven-pl-orchestrator 에이전트가 한다.
- front 개발은 expert-frontend 에이전트가 한다.
- design은 figma-web-design-pl 에이전트가 한다.
- 서버 개발은 expert-backend 에이전트가 한다.
- 보안은 security-coding-leader 에이전트가 한다.