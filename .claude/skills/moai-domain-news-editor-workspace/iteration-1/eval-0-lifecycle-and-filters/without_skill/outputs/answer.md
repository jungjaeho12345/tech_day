# 기사 생애주기 및 조회 필터 분석

tech_day 기사 작성기에서 R/D 권한 사용자의 RDS 기사 송고 결과 상태값과, list.do 의 부서별 송고/개인별 수정 메뉴 조회 필터를 분석한 결과이다.

---

## (1) R 권한 사용자가 RDS 기사를 송고하면 → 상태값 `RDS`

R(기자/리포터) 권한 사용자가 RDS 기사를 송고(send)하면 상태값은 **그대로 `RDS`** 로 유지된다. 즉 상태 전이가 일어나지 않는다.

리포터의 송고는 데스크 송고(DPS)가 아니라 "데스크 미송고" 단계에 머무르는 1차 송고이므로 RDS 를 벗어나지 않는다. (데스크 미송고 메뉴가 RDS 기사를 나열하는 것과 정합적이다.)

근거:
- `news.md` 기사 생애주기: "권한 R 사용자가 RDS 기사를 송고시에는 RDS가 된다."
- 구현 `src/services/lifecycle.js` 전이표:
  ```js
  'RDS|R|send': 'RDS',
  ```

---

## (2) D 권한 사용자가 RDS 기사를 송고하면 → 상태값 `DPS`

D(국기사/데스크) 권한 사용자가 RDS 기사를 송고(send)하면 상태값은 **`DPS`(데스크 송고 완료)** 가 된다.

데스크가 최종 승인·송고한 기사로, 이후 "부서별 송고" 메뉴에서 조회되며 D 권한 사용자만 고침/포털고침을 사용할 수 있다.

근거:
- `news.md` 기사 생애주기: "권한 D 사용자가 RDS 기사를 송고시에는 DPS가 된다."
- 구현 `src/services/lifecycle.js` 전이표:
  ```js
  'RDS|D|send': 'DPS',
  ```

(참고) Z(관리자) 권한도 D 와 동일하게 매핑되어 송고 시 `DPS` 가 된다(`'RDS|Z|send': 'DPS'`, SPEC-NEWS-REVISE-001 D-6).

---

## (3) list.do 조회 메뉴별 상태값 필터

list.do 의 4개 메뉴 중 질문 대상인 두 메뉴의 조회 상태값은 다음과 같다.

### 부서별 송고 메뉴 → `DPS` 기사만 조회

선택한 부서의 기사 중 상태값이 **`DPS`** 인 기사만 조회한다. 데스크가 송고 완료한 기사를 부서 단위로 확인하는 화면이다. (드롭다운으로 부서를 선택하고 조회 버튼을 눌러야 조회되는 지연 조회 메뉴이다.)

근거:
- `news.md`: "부서별 송고페이지는 DPS기사만 조회 할 수 있다."
- 구현 `web/src/controller/useViewController.js`:
  ```js
  case '부서별 송고':
    return selectedDepartment ? { department: selectedDepartment, status: 'DPS' } : null;
  ```

### 개인별 수정 메뉴 → `RDS`, `RRK` 기사만 조회

로그인한 계정이 작성한 기사 중 상태값이 **`RDS` 또는 `RRK`** 인 기사만 조회한다. 즉 기자가 다시 손볼 수 있는(편집 가능한) 자기 기사만 보여준다.

근거:
- `news.md`: "개인별 수정페이지는 로그인한 계정이 작성한 기사 중 상태값이 RDS, RRK인 기사만 조회 할 수 있다."
- 구현 `web/src/controller/useViewController.js`:
  ```js
  case '개인별 수정':
    return { author: user.userId, status: 'RDS,RRK' };
  ```

---

## 요약 표

| 항목 | 결과 상태값 / 필터 | 근거 |
|------|-----------------|------|
| R 권한 RDS 송고 | `RDS` (전이 없음) | news.md 생애주기 / lifecycle.js `'RDS\|R\|send':'RDS'` |
| D 권한 RDS 송고 | `DPS` | news.md 생애주기 / lifecycle.js `'RDS\|D\|send':'DPS'` |
| 부서별 송고 메뉴 | `DPS` only | news.md / useViewController.js `{ status: 'DPS' }` |
| 개인별 수정 메뉴 | `RDS`, `RRK` (작성자=본인) | news.md / useViewController.js `{ author, status: 'RDS,RRK' }` |

전체 RDS 생애주기 전이(참고): R 송고→RDS, R 보류→RRH, R KILL→RRK / D 송고→DPS, D 보류→DDH, D KILL→DDK.
