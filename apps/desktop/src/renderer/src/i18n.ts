// UI copy for the app shell. `en` defines the shape; every other locale must match it exactly.
import { createContext, useContext } from 'react';
import type { Locale } from '@guide/sdk';

const en = {
  nav: { library: 'Library', settings: 'Settings' },
  selectGame: 'Select a game.',
  sidebar: {
    search: 'Search games',
    supported: (count: number) => `Supported games (${count})`,
    running: 'Running',
    noResults: 'No matches.',
  },
  status: { running: 'Running', installed: 'Installed', missing: 'Not installed' },
  search: {
    title: 'Search',
    button: 'Search',
    shortcut: 'Ctrl K',
    placeholder: 'Weapons, items, builds, combos…',
    hint: 'Type a name. Korean initials work too, e.g. ㅋㅇㅅ.',
    noResults: 'Nothing found.',
    footer: '↑↓ move · Enter open · Esc close',
  },
  game: {
    overlay: 'In-game overlay',
    on: 'On',
    off: 'Off',
    change: 'Change',
    content: 'Guide data',
    checkedAgainst: (gameVersion: string) => `Checked against game ${gameVersion}`,
    installDir: 'Install location',
    notFound: 'Not found',
  },
  settings: {
    general: 'General',
    language: 'Language',
    languageDescription: 'Language of the app and the overlay. Item and survivor names come from your game files in the same language.',
    startup: {
      title: 'Startup and tray',
      launchAtLogin: 'Start with Windows',
      launchAtLoginDescription: 'Runs Blueprint when you sign in, so the overlay is ready when a game starts.',
      startHidden: 'Start in the tray',
      startHiddenDescription: 'When started with Windows, stay in the system tray instead of opening the window.',
      closeToTray: 'Keep running in the tray when closed',
      closeToTrayDescription: 'Closing the window keeps the overlay working. Quit from the tray icon menu.',
    },
    followSystem: 'Match system',
    overlayTitle: 'In-game overlay',
    overlayLead:
      'When you launch a supported game, the overlay appears on top of it automatically. Turn it off for all games, one game, or one panel before you play; changes apply immediately, even mid-game.',
    overlayEnabled: 'Use the overlay',
    overlayEnabledDescription: 'When off, the overlay is not shown in any game.',
    gameEnabled: 'Use the overlay in this game',
    gameEnabledLabel: (game: string) => `Overlay in ${game}`,
    showPanel: (panel: string) => `Show ${panel}`,
    pinned: 'Always shown on the game screen',
    holdHotkey: (keys: string) => `Shown while holding ${keys}`,
    onlyWhileHolding: (keys: string) => `Only while holding ${keys}`,
    alwaysShowHint: 'Turn this off if the panel never appears when you hold the key: some anti-cheats stop other programs from reading keys while the game is in front.',
    test: {
      label: 'Test the overlay',
      description: 'Shows every panel over the game for 10 seconds. Press it, then switch to the game.',
      button: 'Test',
      running: (seconds: number) => `Showing for ${seconds}s`,
      results: {
        'not-running': 'Start the game first.',
        disabled: 'The overlay is off for this game.',
        'no-window': 'The game window was not found yet. Set the game to borderless or windowed.',
      } as Record<string, string>,
      notRunning: 'Game not running',
      noWindow: 'Game running, window not found yet',
      tracking: 'Following the game window',
      focused: 'game in front',
      notFocused: 'game in background',
      keySeen: (seconds: number) => `key last seen ${seconds}s ago`,
      keyNever: 'key not seen yet: hold it in game to check',
    },
    toggle: (keys: string) => `${keys} shows or hides it`,
    about: 'About',
    dataSources: 'Data sources',
    fontCredit: 'Font: Pretendard by Kil Hyung-jin, SIL Open Font License 1.1.',
  },
};

export type Messages = typeof en;

const ko: Messages = {
  nav: { library: '라이브러리', settings: '설정' },
  selectGame: '게임을 선택하세요.',
  sidebar: {
    search: '게임 검색',
    supported: (count) => `지원 게임 (${count})`,
    running: '실행 중',
    noResults: '검색 결과가 없습니다.',
  },
  status: { running: '실행 중', installed: '설치됨', missing: '미설치' },
  search: {
    title: '검색',
    button: '검색',
    shortcut: 'Ctrl K',
    placeholder: '무기, 아이템, 빌드, 조합 이름…',
    hint: '이름을 입력하세요. ㅋㅇㅅ처럼 초성으로도 찾을 수 있습니다.',
    noResults: '찾는 항목이 없습니다.',
    footer: '↑↓ 이동 · Enter 열기 · Esc 닫기',
  },
  game: {
    overlay: '인게임 오버레이',
    on: '켜짐',
    off: '꺼짐',
    change: '변경',
    content: '공략 데이터',
    checkedAgainst: (gameVersion) => `게임 ${gameVersion} 기준`,
    installDir: '설치 위치',
    notFound: '찾을 수 없음',
  },
  settings: {
    general: '일반',
    language: '언어',
    languageDescription: '앱과 오버레이의 언어입니다. 아이템·생존자 이름은 같은 언어의 게임 파일에서 가져옵니다.',
    startup: {
      title: '시작과 트레이',
      launchAtLogin: 'Windows 시작 시 자동 실행',
      launchAtLoginDescription: '로그인하면 Blueprint가 켜져서, 게임을 켜는 순간 오버레이가 준비됩니다.',
      startHidden: '트레이로 시작',
      startHiddenDescription: 'Windows와 함께 켜질 때 창을 띄우지 않고 작업 표시줄 트레이에만 둡니다.',
      closeToTray: '창을 닫으면 트레이에서 계속 실행',
      closeToTrayDescription: '창을 닫아도 오버레이는 계속 동작합니다. 완전히 끄려면 트레이 아이콘 메뉴에서 종료하세요.',
    },
    followSystem: '시스템 설정 따르기',
    overlayTitle: '인게임 오버레이',
    overlayLead:
      '지원하는 게임을 실행하면 오버레이가 게임 화면 위에 자동으로 표시됩니다. 게임을 시작하기 전에 전체, 게임별, 패널별로 끌 수 있으며 실행 중에 바꿔도 바로 적용됩니다.',
    overlayEnabled: '오버레이 사용',
    overlayEnabledDescription: '끄면 모든 게임에서 오버레이가 표시되지 않습니다.',
    gameEnabled: '이 게임에서 오버레이 사용',
    gameEnabledLabel: (game) => `${game} 오버레이 사용`,
    showPanel: (panel) => `${panel} 표시`,
    pinned: '게임 화면에 항상 표시',
    holdHotkey: (keys) => `${keys} 키를 누르고 있는 동안 표시`,
    onlyWhileHolding: (keys) => `${keys} 키를 누를 때만 표시`,
    alwaysShowHint: '키를 눌러도 패널이 안 뜨면 이 옵션을 끄세요. 일부 안티치트는 게임이 앞에 있을 때 다른 프로그램이 키 입력을 못 읽게 막습니다.',
    test: {
      label: '오버레이 테스트',
      description: '10초 동안 모든 패널을 게임 위에 띄웁니다. 누른 다음 게임 화면으로 넘어가서 확인하세요.',
      button: '테스트',
      running: (seconds) => `${seconds}초 동안 표시 중`,
      results: {
        'not-running': '게임을 먼저 실행해 주세요.',
        disabled: '이 게임의 오버레이가 꺼져 있습니다.',
        'no-window': '게임 창을 아직 못 찾았습니다. 게임을 테두리 없는 창이나 창 모드로 바꿔 주세요.',
      },
      notRunning: '게임 실행 안 됨',
      noWindow: '게임 실행 중, 창을 아직 못 찾음',
      tracking: '게임 창 따라가는 중',
      focused: '게임이 앞에 있음',
      notFocused: '게임이 뒤에 있음',
      keySeen: (seconds) => `마지막 키 입력 ${seconds}초 전`,
      keyNever: '키 입력 아직 없음: 게임에서 눌러 보면 여기서 확인됩니다',
    },
    toggle: (keys) => `${keys} 키로 켜고 끄기`,
    about: '정보',
    dataSources: '데이터 출처',
    fontCredit: '글꼴: Pretendard (길형진), SIL Open Font License 1.1.',
  },
};

const MESSAGES: Record<Locale, Messages> = { en, ko };

/** Language names are always shown in their own language. */
export const LOCALE_NAMES: Record<Locale, string> = { ko: '한국어', en: 'English' };

export const LocaleContext = createContext<Locale>('en');

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return MESSAGES[useLocale()];
}
