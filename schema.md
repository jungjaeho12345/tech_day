### DB Schema 명세서
mysql를 사용한다.

## 공통조건
모두 varchar로 설정한다

## PK
기사아이디를 primary key로 설정한다.

## Article Table
Article에 대한 명세서
# property
기사아이디, 제목, 본문내용, 마크업내용 버전, 수정자를 정의한다.

## User Table
UserVO에 대한 명세서
# property
유저아이디, 이름, 비밀번호, 권한, 부서, 부서코드

## Content Table
ContentsVO에 대한 명세서
# property
기사아이디, 제목, 본문내용, 작성자, 수정자, 송고자, ,부서 , 부서코드 작성시간, 편집시간, 송고시간., 엠바고 시간, 2차 엠바고 시간, LockYN

## Dept Table
Dept에 대한 명세서
# property
부서아이디, 부서명, 부서 영문명