# 기사 에디터 동작 — 현재 코드 기준 답변

## (1) 클립보드로 붙여넣은 이미지/유튜브의 렌더링 크기

**에디터 대비 가로 17% × 세로 17%** 로 렌더링된다.

- 적용 위치: `web/src/styles/yonhap.css` 의 `.yh-embed--clipboard` 규칙
  - `max-width: 17%;`
  - `max-height: 17%;`
- 크기 로직은 CSS 가 전담한다. `web/src/view/clipboardEmbed.js` 는 붙여넣기 감지·데이터 URL 변환만 담당하고 크기 계산은 하지 않는다.
  - (참고: `clipboardEmbed.js` 상단 주석은 여전히 "10%x10%" 라고 적혀 있으나, 이는 1.7배 적용 이전 문구가 남은 것이고 **실제 CSS 값은 17%** 다. 동작 기준 정답은 17%.)
- 배경: 기존 10%×10% 에 1.7배를 적용(10 × 1.7 = 17)한 결과이며, 같은 변경으로 사진/영상 figure 폭도 360px → **612px** 로 커졌다. 단 기사 참조 카드(`.yh-embed--article`)는 1.7배를 적용하지 않고 **480px** 폭을 유지한다.

## (2) Alt+Y 의 `(끝)` 마커 배치 위치

`(끝)` 마커(골드색)는 **본문 텍스트와 모든 임베드(embeds) 뒤의 "최종 블록"** 으로 배치된다.

최종 시각/블록 순서:

```
본문 텍스트  →  embeds  →  (끝)
```

근거 코드:

- `web/src/model/editorAdapter.js`
  - `appendEnd()` (Alt+Y 핸들러): 본문 텍스트 블록 + 임베드들 뒤에 `(끝)` 텍스트 블록을 붙인다.
    - `blocks: [...contentFromText(bodyText).blocks, ...embeds, { type: 'text', text: END_MARKER_BLOCK }]`
  - **멱등(idempotent)**: 이미 본문이 `(끝)` 으로 끝나면(`hasEndMarker`) 아무 것도 추가하지 않는다 — 중복 삽입 없음.
  - `setBodyText()`: 들어온 텍스트가 `(끝)` 로 끝나면 그 마커를 떼어내(peel) `[...본문, ...embeds, "(끝)"]` 순서를 재구성한다. 이렇게 해서 타이핑 중에도 `(끝)` 이 임베드 *앞* 으로 되돌아가지 않고 항상 맨 뒤에 유지된다.
- `web/src/model/editorContent.js`
  - `END_MARKER = '(끝)'`, 토큰은 prefix-free(앞에 줄바꿈/공백 없이) 정확히 `(끝)` 만 삽입(SPEC-NEWS-REVISE-002).
  - `(끝)` 은 literal 본문 텍스트로 저장되어 markupVersion round-trip(저장→재로드)에서 순서가 보존된다.
  - 임베드는 텍스트를 만들지 않으므로 `contentToText()` 로 만든 본문은 여전히 `(끝)` 으로 끝난다 → 송고 가드(`(끝)` 필수)와 `hasEndMarker` 가 그대로 동작한다.

즉, `(끝)` 은 본문 마지막 글자가 아니라 **임베드까지 모두 지난 뒤의 가장 마지막 블록**에 위치하며, 골드색은 화면 표시(presentation)용으로만 적용된다.
