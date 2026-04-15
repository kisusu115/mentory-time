# 버전 업데이트

유지보수 점검 후 버전을 올리고 CHANGELOG를 작성한다.

**새 버전**: $ARGUMENTS

---

## Phase 1: 유지보수 점검

아래 3개 커맨드를 순서대로 실행하라. 하나라도 🔴 Critical이 있으면 즉시 수정 후 다음으로 넘어간다.

1. `/gc` — 코드-문서 일관성 점검
2. `/samples` — 파서 검증
3. `/check` — lint + build

모두 통과하면 Phase 2로 진행한다.

---

## Phase 2: CHANGELOG 작성

1. `.claude/plans/` 폴더의 EXPLAIN, RESULT 파일들을 모두 읽어라.
2. `docs/CHANGELOG.md`의 최상단(기존 버전 위)에 새 버전 섹션을 추가하라.
3. plans 내용을 기반으로 아래 구조로 정리:
   - **주요 변경 사항**: 사용자가 체감하는 기능 변경 (plans의 EXPLAIN/RESULT에서 추출)
   - **버그 수정**: 버그 수정 항목이 있는 경우에만 섹션 추가
   - **기타**: 내부 개선, UI 미세 조정 등이 있는 경우에만 섹션 추가
4. 작성한 CHANGELOG를 사용자에게 보여주고 확인을 받아라.

---

## Phase 3: 버전 번호 업데이트

사용자가 CHANGELOG를 승인하면 진행한다.

1. `package.json`의 `"version"` 필드를 새 버전으로 변경
2. `manifest.json`의 `"version"` 필드를 새 버전으로 변경
3. 변경 결과를 사용자에게 요약

---

## Phase 4: 최종 검증

1. `/check` 실행 — 버전 변경 후에도 lint + build가 통과하는지 확인
2. 결과 보고: "버전 업데이트 완료: v{이전버전} → v{새 버전}" 한 줄 요약

---

## 규칙

- `$ARGUMENTS`가 비어 있으면 사용자에게 새 버전 번호를 먼저 물어라.
- Phase 간 전환 시 사용자 승인 없이 자동 진행한다 (단, CHANGELOG 내용은 Phase 2에서 확인받는다).
- plans 폴더에 파일이 없으면 사용자에게 CHANGELOG에 넣을 내용을 직접 물어라.
