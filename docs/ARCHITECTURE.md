# Blueprint — 아키텍처 설계 (멀티 게임 공략 & 오버레이)

> 목표: 여러 Steam 게임에 대해 "메인 창(공략 열람)" + "인게임 오버레이"를 제공한다.
> 게임은 **모듈**로 추가하고, 코어는 게임을 모른다.
> 첫 모듈: **Risk of Rain 2 — 생존자별 빌드 추천 트리**.

---

## 0. 설계 원칙

1. **코어는 게임을 모른다.** 감지·오버레이·핫키·콘텐츠 로딩은 코어, "무엇을 보여줄지"는 게임 모듈.
2. **인젝션 없이 시작한다.** 기본 오버레이는 OP.GG의 Stratum 방식(투명 top-most 창 + WinEvent 추적).
   안티치트 위험 0, 게임 FPS 영향 0. DLL 인젝션은 *안티치트 없는 게임에 한해* 나중에 붙일 수 있게 인터페이스만 열어둔다.
3. **상태 감지는 여러 소스를 겹쳐 쓴다.** 수동 선택 → 로그 → 컴패니언 모드 순으로 신뢰도가 올라가며, 없는 소스가 있어도 기능이 동작해야 한다.
4. **콘텐츠는 데이터다.** 빌드 트리는 코드가 아니라 스키마 검증된 YAML. 게임 패치 때 코드 배포 없이 갱신 가능해야 한다.
5. **게임 자산은 재배포하지 않는다.** 이름/설명은 사용자 PC의 게임 설치본에서 런타임에 읽는다.

---

## 1. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 셸 | **Electron + TypeScript** | 웹 UI로 공략 화면 작성이 빠르고, 추후 인젝션 백엔드에 필요한 offscreen 렌더링(`paint` 이벤트)을 그대로 쓸 수 있음 |
| UI | React + Vite (electron-vite) | 메인 창·오버레이 창이 컴포넌트를 공유 |
| 네이티브 | **Rust + napi-rs** (`overlay-native`) | `SetWinEventHook`, `DwmGetWindowAttribute`, `GetAsyncKeyState` — Stratum과 같은 최소 API 집합 |
| 콘텐츠 | YAML + **zod** 스키마 | 사람이 편집하기 쉽고, CI에서 검증 |
| 모노레포 | pnpm workspaces | 코어/SDK/게임 모듈 분리 |

---

## 2. 레포 구조

```
apps/
  desktop/
    src/main/            # Electron main — 코어 서비스
      core/
        GameRegistry.ts      # 게임 모듈 등록/조회
        SteamLibrary.ts      # libraryfolders.vdf / appmanifest 파싱
        GameDetector.ts      # 프로세스·창 감지 → session start/stop
        SessionManager.ts    # 게임 세션 수명주기, StateProvider 구동
        StateStore.ts        # 게임별 상태 스냅샷 + 변경 브로드캐스트
        OverlayManager.ts    # 오버레이 창 1개, 백엔드 선택, 표시/상호작용 모드
        HotkeyService.ts     # GetAsyncKeyState 폴링 (전역 훅 X)
        ContentService.ts    # 번들/원격 콘텐츠 로드·검증·캐시
        Settings.ts
      overlay-backends/
        WindowBackend.ts     # 기본: 투명 top-most 창 + 창 추적
        DetachedBackend.ts   # 폴백: 일반 창(보조 모니터용)
        # InjectedBackend.ts # 추후: goverlay 방식, 안티치트 없는 게임만
    src/preload/
    src/renderer/
      app/                 # 메인 창 (게임 목록, 공략 열람)
      overlay/             # 오버레이 창 (패널 호스트)
packages/
  sdk/                   # 게임 모듈 계약(타입) — 코어와 모듈 사이 유일한 의존점
  overlay-native/        # Rust napi-rs
  content-schema/        # 공통 콘텐츠 스키마(zod) + 검증 CLI
  ui/                    # 공용 컴포넌트 (Tree, ItemChip, Panel frame …)
games/
  ror2/
    manifest.ts          # 순수 데이터: appId, exe, 창 매칭, 안티치트 여부
    main/                # Node 측: 상태 공급자, 게임 파일 리더
    renderer/            # React 측: 앱 뷰, 오버레이 패널
    content/             # 빌드 트리 YAML
    schema.ts            # RoR2 전용 콘텐츠 스키마
```

**의존 방향**: `apps/desktop` → `packages/sdk` ← `games/*`. 게임 모듈은 코어를 import 하지 않는다.
모듈 등록은 **빌드 타임 정적 등록**(`apps/desktop`의 main/renderer 레지스트리 파일에서 배열로 import). 디스크에서 서드파티 플러그인을 동적 로드하는 건 필요해질 때까지 하지 않는다(보안·서명 문제).

---

## 3. 게임 모듈 계약 (`packages/sdk`)

Electron은 main(Node)과 renderer(샌드박스)가 분리되어 있으므로 모듈도 세 조각으로 나눈다.

```ts
// 1) 양쪽에서 쓰는 순수 데이터
export interface GameManifest {
  id: string;                       // "ror2"
  displayName: Record<Locale, string>;
  steamAppId?: number;              // 632360
  process: { exe: string[] };       // ["Risk of Rain 2.exe"]
  window: { title: string; mode: "exact" | "contains" }[];
  antiCheat: "none" | "vac" | "eac" | "battleye" | "vanguard" | "unknown";
  overlay: { backends: OverlayBackendId[] };   // 허용 백엔드, 우선순위 순
}

// 2) main 측
export interface GameMainModule<S extends GameState = GameState> {
  manifest: GameManifest;
  initialState(): S;
  stateProviders(host: MainHost): StateProvider<S>[];
  gameData?(host: MainHost): GameDataReader;   // 로컬 설치본에서 이름/설명 읽기
  contentSchema: ZodType;                      // 이 게임 콘텐츠 검증
}

export interface StateProvider<S> {
  id: string;                         // "manual" | "player-log" | "companion-mod"
  priority: number;                   // 높을수록 신뢰 — 같은 필드 충돌 시 우선
  start(emit: (patch: Partial<S>) => void): Disposable;
}

// 3) renderer 측
export interface GameRendererModule<S extends GameState = GameState> {
  manifest: GameManifest;
  appViews: AppView[];                // 메인 창 탭
  overlayPanels: OverlayPanel<S>[];
}

export interface OverlayPanel<S> {
  id: string;                         // "build-tree"
  component: React.LazyExoticComponent<React.FC<{ state: S }>>;
  defaultAnchor: Anchor;              // { edge: "right", offset: {x,y}, size }
  visibility: "hold-hotkey" | "toggle" | "pinned";
  hotkey?: VkCode[];
}
```

`MainHost`는 코어가 모듈에 주는 제한된 API: 파일 tail, 게임 설치 경로, 로거, 설정 읽기, 로컬 WS 서버 등.

---

## 4. 런타임 흐름

```
SteamLibrary ──(설치 경로)──┐
                           ▼
GameDetector ── 프로세스/창 감지 ──► SessionManager.start(ror2)
                                          │
                        ┌─────────────────┼────────────────────┐
                        ▼                 ▼                    ▼
                 StateProvider[]    OverlayManager.attach   ContentService.load(ror2)
                        │                 │
                  patch(우선순위 병합)      │ WinEvent: focus/move/blur
                        ▼                 ▼
                    StateStore ──IPC──► overlay renderer ──► OverlayPanel들
                                         (창 1개에 패널 여러 개)
```

- **GameDetector**: 1~2초 간격 프로세스 목록 확인은 가볍다. 창을 찾은 뒤에는 폴링을 멈추고 네이티브 WinEvent 콜백으로 전환.
- **StateStore**: 필드 단위로 "어느 provider가 썼는지" 기록 → 낮은 우선순위 provider가 높은 쪽 값을 덮어쓰지 못함.

---

## 5. 오버레이 설계

### 5.1 백엔드

```ts
interface OverlayBackend {
  id: "window" | "detached" | "injected";
  isSupported(target: TargetWindow, manifest: GameManifest): SupportResult;
  attach(target: TargetWindow): void;
  detach(): void;
  setInteractive(on: boolean): void;   // 클릭 통과 ↔ 입력 받기
  setVisible(on: boolean): void;
}
```

| 백엔드 | 방식 | 조건 |
|---|---|---|
| `window` (기본) | 투명·frameless·`alwaysOnTop("screen-saver")`·`setIgnoreMouseEvents(true,{forward:true})`, 게임 창 bounds 추적 | 게임이 **창/테두리 없는 창** 모드 |
| `detached` (폴백) | 일반 창. 보조 모니터에 띄우거나 Alt-Tab | 항상 가능 |
| `injected` (추후) | offscreen 렌더 → 공유메모리 → DXGI Present 후킹 합성 | `antiCheat === "none"`이고 사용자가 명시적으로 켠 경우만 |

> **전용 전체화면 문제**: `window` 백엔드는 전용 전체화면 위에 안정적으로 보장되지 않는다.
> RoR2의 `window_mode` 값과 Unity 모드 매핑(`WindowModeConVar.SetString` IL로 확인):
> `Fullscreen`(메뉴의 "전체 화면") → FullScreenWindow(테두리 없음), `Window` → Windowed,
> `FullscreenExclusive`(콘솔 전용) → ExclusiveFullScreen.
> 즉 메뉴에서 고를 수 있는 두 모드는 모두 오버레이와 호환된다. `FullscreenExclusive`일 때만
> 안내 + `detached` 폴백을 제공한다 (`Risk of Rain 2_Data/Config/config.cfg`의 `window_mode`로 판단).

### 5.2 성능 규칙 (OP.GG 분석에서 가져온 것)

- **오버레이 창은 1개**. 패널마다 BrowserWindow를 만들지 않는다 (렌더러 프로세스 1개당 수십 MB).
- **안 보일 땐 숨긴다**: 표시 중인 패널이 없으면 `hide()` → Chromium 렌더링 정지. 보일 때는 `showInactive()`로 게임 포커스를 뺏지 않음.
- **추적은 이벤트 기반**: `SetWinEventHook`(EVENT_SYSTEM_FOREGROUND, EVENT_OBJECT_LOCATIONCHANGE) + `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)`로 실제 경계 → DIP 변환.
- **`moveTop()`은 focus/대상 변경/첫 표시 때만.**
- **핫키는 `GetAsyncKeyState` 폴링(50~100ms)**, 전역 저수준 훅 사용 안 함 — 키를 삼키지 않으므로 게임 입력과 공존. (예: RoR2의 Tab(스코어보드/인벤토리)과 같은 키로 빌드 트리를 함께 띄울 수 있음)
- **상호작용 모드**: 기본은 클릭 통과. 핫키를 누르고 있는 동안에만 `setIgnoreMouseEvents(false)`.
- 오버레이 UI는 무한 애니메이션 금지, 상태 변경 시에만 리렌더.
- 패널 표시 방식: `pinned`(항상) / `hold-hotkey`(누르는 동안) / `toggle`(누를 때마다). 핫키 폴링은
  게임에 포커스가 있고 핫키를 쓰는 패널이 있을 때만 돈다.

### 5.3 UI 테마

Steam 라이브러리 톤. 색·폰트 토큰은 `apps/desktop/src/renderer/src/theme.css`의 `--gg-*` 변수로만 정의하고,
메인 창·오버레이·게임 모듈 컴포넌트가 모두 이 변수를 쓴다(게임 모듈은 하드코딩 색 금지).
게임 아트(히어로·로고·아이콘)는 사용자 PC의 Steam 캐시(`appcache/librarycache/<appId>`)에서
`steam-art://library/<appId>/<kind>` 프로토콜로 런타임에 읽는다 — 앱에 포함하지 않는다.

---

- 글꼴: **Pretendard** 가변 폰트(SIL OFL 1.1, 상업적 사용 가능)를 `renderer/src/assets/fonts/`에 번들하고
  라이선스 전문(`Pretendard-LICENSE.txt`)을 함께 둔다. 외부 CDN 없음.
- 출처·데이터 크레딧은 공략 화면에 두지 않는다. 게임 모듈의 `creditsView`가 **설정 → 정보**에만 표시된다.

### 5.3.1 로컬라이제이션 (ko / en)

- UI 문구는 코드에 직접 쓰지 않는다. 앱 셸은 `apps/desktop/src/renderer/src/i18n.ts`, 게임 모듈은
  `games/<id>/src/renderer/i18n.ts`에 둔다. `en` 객체가 타입을 정의하고 다른 언어는 같은 타입을 따라야
  하므로, 키가 빠지면 타입체크에서 걸린다.
- 게임 모듈은 `useGameUi().locale`로 언어를 받는다(앱 셸 코드에 의존하지 않음).
- 공략 콘텐츠는 `{en, ko}`로 저장하고, 게임 고유 이름(아이템·생존자·스킬)은 같은 언어의 게임 파일에서 읽는다.
- 설정 `ui.locale`: `system`(기본) / `ko` / `en`. `system`은 Windows 표시 언어가 아니라 **사용자 언어 목록**
  (`app.getPreferredSystemLanguages()`)을 따른다. 영어 Windows에 한국어 사용자인 경우를 위해서다.
- 언어가 정해지기 전에는 첫 화면을 그리지 않아 다른 언어가 깜빡이지 않는다.

### 5.4 UI 호스팅 전략 (지금: 번들 / 나중: 원격 가능)

OP.GG는 메인 창 UI를 원격 웹앱으로 호스팅한다. 우리는 **UI는 앱에 번들, 데이터(콘텐츠)만 원격 갱신**으로
시작하되, 원격 UI로 바꿀 때 코드 변경이 한 곳에 모이도록 만들어 두었다.

- `main/ui/UiSource.ts` — 페이지를 어디서 로드할지, 어떤 URL을 신뢰할지 결정하는 유일한 지점.
  원격 전환 시 `RemoteUiSource`(원격 로드 + `did-fail-load` 시 번들 폴백 + 두 출처 신뢰)만 추가한다.
- `main/ui/trustedIpc.ts` — 모든 IPC 핸들러가 발신 프레임 URL을 `UiSource.isTrustedUrl`로 검사한다.
- `web-contents-created`에서 신뢰하지 않는 URL로의 이동 차단, 새 창은 외부 브라우저로.
- `DESKTOP_API_VERSION` — 원격 UI가 설치된 앱의 API 버전을 확인할 수 있게 preload가 노출.
- 게임 모듈은 `window.desktop`을 직접 쓰지 않고 `@guide/sdk/react`의 `useGameUi()`(content, text, invoke)만 쓴다.
  전송 방식이 바뀌어도 모듈 코드는 그대로다.

## 6. 콘텐츠 파이프라인

```
games/ror2/content/*.yaml ──(CI: zod 검증 + ID 존재 검사)──► 번들
                                                         └► 원격 CDN (manifest.json: 버전·해시)
ContentService: 번들 로드 → 원격 manifest 확인 → 해시 검증 후 캐시 교체
```

- 원격 업데이트는 MVP 이후. 처음엔 번들만.
- 구현: `main/core/ContentService.ts`가 `ContentSource[]`를 순서대로 시도하고, 모듈의 `content.parse()`로
  검증한 첫 결과를 쓴다. 원격 소스는 번들 소스 **앞에** 추가하면 되고, 검증에 실패하면 자동으로 번들로 폴백한다.
- 번들 콘텐츠는 `games/<id>/content/**/*.yaml`을 `import.meta.glob`으로 포함 — 파일 추가만으로 반영된다.
- **버전 관리**: 모든 문서는 헤더 `kind / schemaVersion / revision / updatedAt`로 시작하고, 콘텐츠 전체는
  `manifest.yaml`의 `version`(YYYY.MM.DD.N)·`gameVersion`·`updatedAt`을 가진다. 문서 종류는 파일 경로가 아니라
  `kind`로 구분하므로, DB로 옮기면 문서 1개 = 행 1개(헤더 = 메타 컬럼)가 된다.
  - 콘텐츠를 고친 뒤 `pnpm --filter @guide/game-ror2 content:stamp` → 내용 해시가 바뀐 문서만 revision+1,
    updatedAt=오늘, manifest version 증가. 상태는 `content/content.lock.json`에 기록.
  - 스탬프 없이 내용이 바뀌면 테스트가 실패한다(`content:check`도 같은 검사).
  - 앱이 지원하는 `CONTENT_SCHEMA_VERSION`보다 높은 문서는 거부 → 다음 소스(최종적으로 번들)로 폴백.
    원격 업데이트가 구버전 앱을 망가뜨리지 않는다.
- **이미지**: 콘텐츠에는 이미지 파일명(`icon`)만 저장한다. 모듈의 `content.asset()`이 원격 URL 후보(현재 위키 CDN)를
  돌려주고, 코어의 `game-asset://<game>/<kind>/<id>` 프로토콜이 처음 한 번 받아 `userData/asset-cache`에 캐시한다
  (동시 4개, 429/5xx 재시도, 실패 URL 10분 보류). 게임 아트는 앱에 포함하지 않는다.
  - 위키 원본은 수 MB(무기 렌더 3840px)일 수 있어 `mediaWikiImage()`로 **썸네일 → 원본** 순서의 후보를 준다(약 100배 작음).
  - 모듈의 `content.assets()`가 쓰는 이미지 전체를 알려주면, 코어가 시작 4초 뒤 **백그라운드로 미리 받는다**.
    미리받기는 슬롯 일부만 쓰고, 화면에 보이는 이미지는 대기열을 건너뛴다(대기 중인 미리받기는 승격).
- 검증: `pnpm test`가 번들 콘텐츠 전체를 파싱·교차검증한다(CI 역할).
  `ROR2_INSTALL_DIR=<설치 경로> pnpm --filter @guide/game-ror2 test`는 모든 토큰이 실제 게임 언어 파일에
  있는지도 확인한다(한국어·영어).
- 콘텐츠에는 **게임 내부 ID만** 쓴다(`Syringe`, `MageBody`). 표시 이름은 런타임에 로컬 게임 파일에서 해석:
  `…/Risk of Rain 2_Data/StreamingAssets/Language/{ko,en,…}/*.json`
  (예: `MAGE_BODY_NAME → "아티피셔"`, `ITEM_BEAR_NAME → "힘들었던 시절"`).
  → 게임 텍스트를 재배포하지 않고, 패치 시 이름 변경도 자동 반영.
- **아이콘**: 게임 아트는 저작권 대상이라 번들 금지. MVP는 이름 + 티어 색상 칩. 아이콘은 추후 사용자 로컬 설치본에서 추출하는 방안을 검토.

---

## 7. 첫 모듈: Risk of Rain 2 빌드 추천 트리

### 7.1 manifest

```ts
export const manifest: GameManifest = {
  id: "ror2",
  displayName: { ko: "리스크 오브 레인 2", en: "Risk of Rain 2" },
  steamAppId: 632360,
  process: { exe: ["Risk of Rain 2.exe"] },
  window: [{ title: "Risk of Rain 2", mode: "exact" }],
  antiCheat: "none",
  overlay: { backends: ["window", "detached"] },
};
```

### 7.2 상태

```ts
interface Ror2State extends GameState {
  phase: "unknown" | "menu" | "character-select" | "in-run";
  survivor?: string;          // body 내부 ID, 예: "MageBody"
  buildId?: string;           // 사용자가 고른 빌드
  stage?: number;
  inventory?: Record<string, number>;   // itemId → 개수 (컴패니언 모드 있을 때만)
}
```

### 7.3 상태 공급자 — 단계적 도입

| 단계 | provider | 얻는 것 | 비고 |
|---|---|---|---|
| **MVP** | `manual` | 생존자·빌드 | 오버레이/메인 창에서 선택, 마지막 선택 기억 |
| 2 | `player-log` | phase(대략), 장면 전환 | `%USERPROFILE%/AppData/LocalLow/Hopoo Games, LLC/Risk of Rain 2/Player.log` tail. **생존자 정보는 로그에 없음**(확인함) |
| 3 | `companion-mod` | 생존자·스테이지·인벤토리 실시간 | BepInEx 플러그인 → `ws://127.0.0.1:<port>` 로 JSON push. 옵트인. 있으면 생존자 자동 선택 + 트리에서 보유 아이템 하이라이트 |

화면 OCR(OP.GG 방식)은 비용 대비 효과가 낮아 보류.

### 7.4 빌드 트리 콘텐츠 모델

트리는 **단계(phase) 노드의 DAG**. 각 노드는 우선 아이템 묶음이고, 분기에는 조건이 붙는다.

```yaml
# games/ror2/content/survivors/mage.yaml
survivor: MageBody
patch: "1.3.x"            # 검증 기준 게임 버전
builds:
  - id: mage-flamethrower-proc
    title: { ko: "화염방사 프록 빌드", en: "Flamethrower Proc" }
    difficulty: beginner
    loadout:              # 스킬 슬롯 → 스킬 내부 ID
      primary: MageBodyFireFirebolt
      special: MageBodyFlamethrower
    summary: { ko: "…" }
    root: core
    nodes:
      - id: core
        phase: early            # early | mid | late | lunar | void
        items:
          - { id: Syringe, priority: core }
          - { id: SprintBonus, priority: optional, note: { ko: "기동성 보완" } }
        next: [proc, crit]
      - id: proc
        label: { ko: "프록 루트" }
        when: { ko: "초록 아이템에서 우쿨렐레를 먹었다면" }
        phase: mid
        items:
          - { id: ChainLightning, priority: core }
        next: [late-common]
      - id: crit
        label: { ko: "치명타 루트" }
        phase: mid
        items:
          - { id: CritGlasses, priority: core, stacks: 10 }
        next: [late-common]
      - id: late-common
        phase: late
        items:
          - { id: Behemoth, priority: situational }
    avoid:
      - { id: …, reason: { ko: "…" } }
```

(아이템/스킬 ID는 예시 — 실제 값은 게임 데이터에서 추출한 ID 목록과 대조해 CI에서 검증한다.)

**검증 규칙 (CI)**
- 모든 `items[].id`, `survivor`, `loadout.*`이 추출된 ID 목록에 존재
- `root`에서 모든 노드 도달 가능, 사이클 없음
- `next`가 가리키는 노드 존재

**현재 콘텐츠 (2026-09-26, 게임 v1.4.1 Alloyed Collective 기준)**
- 아이템·장비 217개: 위키 데이터 모듈에서 조사하고, 내부 ID와 DLC는 `RoR2.dll`의 `RoR2Content`/`DLC1~3Content`
  정적 필드로, 이름·효과 토큰은 설치된 게임의 한국어·영어 언어 파일로 검증했다. 등급(티어)만 웹 출처에 의존한다.
- 생존자 19명(Body 이름은 `RoR2.dll`의 `BodyPrefabs`로 확인), 빌드 34개.
  빌드별 `evidence`(근거)와 생존자별 `sources`·`sourceQuality`(strong/mixed/thin)를 함께 저장하고 화면에 보여준다.
- 주의: 출처 대부분은 추천 아이템 목록만 주므로, 초반/중반/후반 분기와 `when` 조건은 그 목록을 바탕으로 정리한 것이다.
- 긴 판(루프 반복) 대응 — 특정 스테이지 번호가 아니라 **조건과 전환점**으로 쓴다:
  - 노드 아이템의 `stacks: {min, max?}` + `stacksReason`: 권장 개수(max 없음 = 많을수록 좋음). 위키 수치로 계산한 상한은 이유에 명시.
  - `phase: loop` 노드: 첫 루프 이후 계속 챙길 것.
  - `milestones[]`: "치명타 100% 도달 → 안경 그만, 폭발하는 비장 챙기기"처럼 조건 → 조언 → `take`/`stop`.
  - `pickOrder`: 프린터·커맨드·멀티샵에서 같은 등급 중 고를 때의 순서(등급 일치 검증).
- 아이템 상세 설명은 게임의 `ITEM_*_DESC`(중첩당 수치 포함)를 게임 색상 그대로 표시한다(`<style=cIsDamage>` 등을 안전하게 파싱).

### 7.5 화면

- **메인 창 `빌드` 탭**: 생존자 그리드 → 빌드 카드 목록 → 트리 뷰(좌→우 early→late, 분기 조건 라벨).
- **오버레이 패널 `build-summary`**: 폭 300의 작은 요약(OP.GG가 인게임에는 스킬 순서 같은 힌트만 띄우는 것과 같은 원칙).
  "초반 핵심" 아이템 최대 5개 + 다음 분기와 조건. 전체 트리는 메인 창에서만 본다.
  - 따라갈 빌드는 메인 창 빌드 탭의 "오버레이에 이 빌드 표시"로 고른다(`games/ror2.json`에 저장, `manual` provider).
  - `visibility: "pinned"` — OP.GG처럼 게임이 실행되면 자동으로 표시되고, 게임 포커스를 잃으면 숨는다.
  - 메인 앱 설정에서 전체 / 게임별 / 패널별로 미리 끌 수 있다 (`userData/settings.json`, 실행 중 변경 즉시 반영).
  - 컴패니언 모드가 있으면 보유 아이템 체크 표시 + "다음 추천" 노드 강조.
- **오버레이 패널 `picker`**: 생존자/빌드 선택 (상호작용 모드에서만).

---

## 7b. 두 번째 모듈: Helldivers 2 로드아웃·전쟁 채권

- **manifest**: appId 553850, `helldivers2.exe`, 안티치트 GameGuard → 주입 없는 창 오버레이만 사용.
- **콘텐츠**(`games/helldivers2/content`, 게임 파일을 읽을 수 없어 이름은 콘텐츠에 ko/en으로 둔다):
  `weapons / stratagems / perks / missions / loadouts/<faction> / warbonds / ratings / customization`.
  파서가 교차검증한다(슬롯 종류, 백팩 중복, 미션-진영, 채권 아이템·평가·부착물 ID). 연구 JSON→YAML 변환 중 출처 충돌은 편집 판단으로 해소.
- **화면**:
  - 로드아웃 — 적(진영) → 미션(분류별) → 맞는 로드아웃. 전용이 없으면 범용 로드아웃으로 대체. 보유 채권을 체크했다면 없는 장비를 흐리게 표시하고 필요한 채권을 알려준다.
  - 전쟁 채권 — 플레이 성향·주적 선택 → `recommendWarbonds()`(순수 함수, 테스트 있음)가 "새로 얻는 장비의 티어 + 완성되는 로드아웃"을 SC 1,000당 점수로 순위화. 페이지별 메달 비용, 쓸 만한 아이템까지 필요한 메달 추정.
  - 무기고 — 스트라타젬(커맨드)·무기·방어구/부스터, 티어/인기/이름 정렬, 호버에 평가·얻는 방법·추천 부착물.
- **오버레이** `stratagem-codes`: Ctrl(스트라타젬 키)을 누르는 동안 고른 로드아웃의 커맨드 4개 + 증원/보급.
- **보유 채권**은 게임 서버에만 있어 PC에서 읽을 수 없다 → 사용자가 한 번 체크(`profile`, 모듈 저장소).

RoR2에도 같은 방식의 아이템 평가(`content/ratings.yaml`: 같은 등급 내 S–D, 인기도, 특히 좋은 생존자)를 둔다.

---

## 8. 새 게임 추가 체크리스트

1. `games/<id>/manifest.ts` — appId, exe, 창 제목, 안티치트 여부
2. 상태 타입 + 최소 `manual` provider
3. 콘텐츠 스키마 + YAML
4. 오버레이 패널 1개 이상
5. `apps/desktop/package.json` 의존성에 추가하고, `apps/desktop/src/main/games.ts`(main)와
   `apps/desktop/src/renderer/src/games.ts`(renderer) 두 곳에 등록

코어 수정 없이 여기까지로 동작해야 한다. 코어를 고쳐야 한다면 그건 SDK에 빠진 확장점이 있다는 신호.

---

## 9. 마일스톤

| # | 범위 | 완료 기준 |
|---|---|---|
| M0 | 모노레포 + Electron 셸 + SDK 타입 + 정적 게임 등록 | 메인 창에 등록된 게임 목록 표시 |
| M1 | SteamLibrary + GameDetector + `overlay-native` 도입(`listProcesses`) | RoR2 실행/종료가 세션 이벤트로 잡힘 |
| M2 | `overlay-native`에 창 추적·키 상태 추가 + WindowBackend + HotkeyService | 테두리 없는 창 RoR2 위에 Tab 홀드로 빈 패널 표시·추적 |
| M3 | RoR2 콘텐츠 스키마 + 게임 언어 파일 리더 + 생존자 2~3명 빌드 | 메인 창에서 한국어 이름으로 트리 열람 |
| M4 | 오버레이 `build-tree` + `picker` 패널, 수동 선택 | 인게임에서 선택한 빌드 트리 확인 |
| M5 | 전체 생존자 콘텐츠 + CI 검증 | 모든 ID 검증 통과 |
| M6 | 두 번째 게임: Helldivers 2 (로드아웃·전쟁 채권 추천·오버레이 커맨드) | 코어 수정 없이 모듈 추가만으로 동작 |
| M7+ | player-log provider, 컴패니언 모드, 원격 콘텐츠 | — |

두 번째 게임은 M4 직후에 **작은 것 하나**를 붙여보는 걸 권장 — SDK가 RoR2에 과적합됐는지 가장 빨리 드러난다.
