# 기사 에디터 동작 분석 (현재 코드 기준)

분석 대상: `web/src/` 실제 소스. (questions: 클립보드 임베드 렌더링 크기 / Alt+Y `(끝)` 마커 배치)

---

## (1) 클립보드로 붙여넣은 이미지/유튜브의 렌더링 크기

**에디터 대비 최대 17% × 17% 크기로 렌더링된다.** (가로 17%, 세로 17%)

### 근거
- 클립보드(붙여넣기) 출처 임베드는 뷰 빌드 시 `yh-embed--clipboard` 클래스가 추가된다.
  - `web/src/view/WritePage.jsx:179`, `:195` — `if (embed.source === 'clipboard') span.classList.add('yh-embed--clipboard');` (이미지·영상 모두 적용)
- 크기는 코드 로직이 아니라 CSS로 제한된다. `web/src/view/clipboardEmbed.js`의 주석도 "sizing is handled by the existing `.yh-embed` CSS — no size logic here"라고 명시한다.
- 실제 CSS (`web/src/styles/yonhap.css:1079`):
  ```css
  .yh-embed--clipboard {
    max-width: 17%;
    max-height: 17%;
  }
  ```

### 중요 — "10%"는 옛 값이며 현재 코드는 17%
같은 CSS의 주석(`yonhap.css:1077`)에 변경 이력이 남아 있다:
> 에디터크기가 100%이고 가로*세로=10%*10% 이었으나, 1.7배 적용으로 17%*17% 로 키운다 (10×1.7=17). max-width/max-height 로 에디터 크기 대비 17% 제한.

즉, `clipboardEmbed.js` 상단 주석에는 아직 "The 10%x10% sizing..."이라는 **낡은 문구가 남아 있으나**, 실제 적용되는 CSS 값은 **17% × 17%**이다. 현재 코드 동작 기준 정답은 **17%**다.

> 참고: 클립보드가 아닌 일반(검색/링크) 임베드 figure는 `max-width: 612px`(이미지·영상), 기사 카드는 `max-width: 480px`의 고정 px 폭을 쓴다. 17% 비율 제한은 클립보드 출처에만 적용된다.

---

## (2) Alt+Y `(끝)` 마커의 배치 위치

**`(끝)` 마커는 본문 텍스트와 모든 임베드보다 뒤, 즉 콘텐츠 최후미(맨 마지막 블록)에 배치된다.**

최종 시각/블록 순서:

```
본문 텍스트  →  임베드(들)  →  (끝)
```

### 근거 (모델 → 어댑터 → 뷰 일관성)
- 토큰은 정확히 `(끝)` (prefix-free). `web/src/model/editorContent.js:22` `END_MARKER = '(끝)'`, `:28` `END_MARKER_BLOCK = END_MARKER`.
  - SPEC-NEWS-REVISE-002 주석(`editorContent.js:24`): Alt+Y는 `(끝)` 토큰만 삽입하며, 이전의 `"\n (끝)"`(앞에 줄바꿈+공백) 형식을 단순화해 **줄바꿈 없이 본문 끝에 인라인으로 흐르도록** 바뀌었다.
- 어댑터 `appendEnd()` (`web/src/model/editorAdapter.js:99`):
  ```js
  appendEnd() {
    const bodyText = contentToText(content);
    if (hasEndMarker(bodyText)) return; // 이미 있으면 중복 추가 안 함 (idempotent)
    const embeds = content.blocks.filter((b) => b.type === 'embed');
    content = {
      blocks: [...contentFromText(bodyText).blocks, ...embeds, { type: 'text', text: END_MARKER_BLOCK }],
    };
  }
  ```
  → 블록 배열이 `[...본문 텍스트, ...임베드, "(끝)" 블록]` 순으로 재구성된다. 마커는 **모든 임베드 뒤의 마지막 블록**이다.
- `setBodyText()`도 동일 순서를 유지한다(`editorAdapter.js:79`). 타이핑이 이어져도 마커를 떼어내 임베드 뒤에 다시 붙여, 다음 키 입력에서 마커가 임베드 앞으로 되돌아가는 것을 방지한다.
- 컨트롤러 (`web/src/controller/useWriteController.js:220`): "Alt+Y places `(끝)` as the FINAL block AFTER all embeds." `appendEnd`는 키 핸들러의 `onAltY`로 연결된다(`WritePage.jsx:740` Alt+Y 감지 → `onAltY()` → `WritePage.jsx:801` `onAltY={ctrl.appendEnd}`).

### 표현 및 동작 특성
- **색상**: 뷰가 본문 끝의 `(끝)` 발생부를 골드(gold/골드색)로 표시한다. 단 이는 순수 표현(presentational)이며 저장되는 토큰 자체는 `(끝)`뿐이다 (`editorContent.js:20-21`).
- **멱등성(idempotent)**: 본문이 이미 `(끝)`로 끝나면 Alt+Y 재입력은 no-op(중복 미추가). 후행 공백/줄바꿈도 허용하며, 레거시 `"\n (끝)"` 형식도 "이미 존재"로 인정한다 (`hasEndMarker`, `editorContent.js:40-42`).
- **영속성**: `(끝)`은 literal trailing text 블록으로 저장되어 markupVersion 라운드트립(저장→재로드) 시 임베드 뒤 순서가 유지된다.
- **송고 가드 연동**: 임베드는 텍스트를 기여하지 않으므로 `getBodyText()`는 여전히 `(끝)`로 끝나고, 송고 시 "본문에 (끝) 표시가 없어 송고할 수 없습니다" 가드(`useWriteController.js:284-285`)를 통과한다.

---

## 요약

| 질문 | 답 (현재 코드 기준) |
|---|---|
| (1) 클립보드 이미지/유튜브 렌더링 크기 | 에디터 대비 **최대 17% × 17%** (`.yh-embed--clipboard { max-width:17%; max-height:17% }`). 코드 주석의 "10%×10%"는 1.7배 확대 전의 낡은 값. |
| (2) Alt+Y `(끝)` 마커 위치 | **본문 텍스트 → 임베드(들) → `(끝)`** 순. 모든 임베드 뒤, 콘텐츠 최후미의 마지막 블록. 골드색은 표현일 뿐 토큰은 `(끝)`. 멱등·영속·송고가드 연동. |
