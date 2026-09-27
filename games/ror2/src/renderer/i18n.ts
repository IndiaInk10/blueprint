// UI copy for the Risk of Rain 2 module. `en` defines the shape; every other locale must match it.
// Game names (items, survivors, skills) are not here: they come from the game's own files.
import type { Locale } from '@guide/sdk';
import { useGameUi } from '@guide/sdk/react';
import type { Build, Dlc, ItemTier, Phase, Priority, SkillSlot } from '../content/schema';

const en = {
  loading: 'Loading…',
  survivors: 'Survivors',
  follow: 'Show this build in the overlay',
  following: 'Shown in the overlay · Remove',
  followingDot: 'Shown in the overlay',
  anySkill: 'Any',
  sections: {
    tree: 'Item tree',
    guide: 'Run guide',
    guideHint: 'Change direction in this order as the run goes on',
    picks: 'Pick order',
    picksHint: 'When choosing within one tier: printers, Command, multishops',
    avoid: 'Items to avoid',
  },
  credits: {
    gameFiles: 'Item, survivor and skill names and descriptions are read from your installed game.',
    images: 'Item and survivor images are downloaded from the Risk of Rain 2 Wiki and cached on this PC:',
    builds: (gameVersion: string, updatedAt: string) =>
      `Builds are compiled from the community guides below, checked against game ${gameVersion} (updated ${updatedAt}).`,
  },
  legend: { core: 'Core', optional: 'Optional', situational: 'Situational' },
  take: 'Take',
  stop: 'Stop',
  stacks: {
    heading: 'Count',
    target: (n: number) => `Aim for ${n}`,
    min: (n: number) => `at least ${n}`,
    max: (n: number) => `at most ${n}`,
    noMore: 'no benefit past this',
    moreIsFine: 'more is fine',
  },
  items: {
    search: (count: number) => `Search ${count} items (name or effect)`,
    all: 'All',
    tiers: 'Tiers',
    noResults: 'No matches.',
    sort: { rank: 'Rank', popularity: 'Most taken', name: 'Name' },
    topOnly: 'S and A only',
    inBuilds: 'In these survivor builds',
    inCombos: 'In these theme builds',
  },
  rating: {
    rank: (rank: string) => `Rank ${rank} in its rarity`,
    popularity: {
      'very-high': 'Almost always taken',
      high: 'Popular',
      medium: 'Common',
      low: 'Niche',
      rare: 'Rarely taken',
    } as Record<string, string>,
    popularTag: 'Popular',
    bestFor: 'Best on',
  },
  search: { survivors: 'Survivors', items: 'Items', builds: 'Builds' },
  combos: {
    title: 'Theme builds',
    search: 'Search builds or survivors',
    intro: 'Item builds picked for fun, not for the best clear: a theme to chase at printers, shrines and lunar pods.',
    all: 'All',
    focus: { survivor: 'Survivors', items: 'Items', equipment: 'Equipment', challenge: 'Challenges' } as Record<string, string>,
    tags: { theme: 'Theme', chaos: 'Chaos', challenge: 'Challenge', solo: 'Solo', team: 'Team', 'long-run': 'Long run' } as Record<string, string>,
    anyone: 'Any survivor',
    fits: 'Fits',
    items: 'Items to chase',
    equipment: 'Equipment',
    avoid: 'Skip these',
    whyFun: 'Why it is fun',
  },
  survivorRating: {
    rank: (rank: string) => `Tier ${rank}`,
    difficulty: { easy: 'Easy to play', medium: 'Moderate to play', hard: 'Hard to play' } as Record<string, string>,
    strengths: 'Strengths',
    weaknesses: 'Weaknesses',
    order: { default: 'Default', rank: 'By tier' },
  },
  recommended: {
    title: 'Items this survivor loves',
    hint: 'Beyond the tree: rated items that suit this survivor especially well.',
  },
  summary: {
    empty: 'Pick a build to follow in the Builds tab of the main app, and its summary shows up here.',
    earlyCore: 'Early core',
    nextBranches: 'Next branches',
  },
  phases: { early: 'Early', mid: 'Mid', late: 'Late', loop: 'After loop' } satisfies Record<Phase, string>,
  slots: { primary: 'Primary', secondary: 'Secondary', utility: 'Utility', special: 'Special' } satisfies Record<SkillSlot, string>,
  difficulty: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } satisfies Record<
    Build['difficulty'],
    string
  >,
  priority: { core: 'Core', optional: 'Optional', situational: 'Situational' } satisfies Record<Priority, string>,
  tiers: {
    common: 'Common',
    uncommon: 'Uncommon',
    legendary: 'Legendary',
    boss: 'Boss',
    lunar: 'Lunar',
    void: 'Void',
    meal: 'Meal',
    equipment: 'Equipment',
    'lunar-equipment': 'Lunar equipment',
    'elite-equipment': 'Elite equipment',
  } satisfies Record<ItemTier, string>,
  dlc: {
    base: 'Base game',
    sotv: 'Survivors of the Void',
    sots: 'Seekers of the Storm',
    ac: 'Alloyed Collective',
  } satisfies Record<Dlc, string>,
};

export type Ror2Messages = typeof en;

const ko: Ror2Messages = {
  loading: '불러오는 중…',
  survivors: '생존자',
  follow: '오버레이에 이 빌드 표시',
  following: '오버레이에 표시 중 · 해제',
  followingDot: '오버레이에 표시 중',
  anySkill: '자유',
  sections: {
    tree: '아이템 트리',
    guide: '진행 가이드',
    guideHint: '판이 길어질수록 이 순서로 방향을 바꾸세요',
    picks: '선택 우선순위',
    picksHint: '프린터·커맨드·멀티샵에서 같은 등급 중 고를 때',
    avoid: '피해야 할 아이템',
  },
  credits: {
    gameFiles: '아이템·생존자·스킬의 이름과 설명은 설치된 게임 파일에서 읽어옵니다.',
    images: '아이템·생존자 이미지는 Risk of Rain 2 위키에서 받아 이 PC에 저장해 둡니다:',
    builds: (gameVersion, updatedAt) => `빌드는 아래 커뮤니티 공략들을 바탕으로 정리했습니다. 게임 ${gameVersion} 기준 (${updatedAt} 업데이트).`,
  },
  legend: { core: '핵심', optional: '선택', situational: '상황에 따라' },
  take: '챙기기',
  stop: '그만',
  stacks: {
    heading: '개수',
    target: (n) => `목표 ${n}개`,
    min: (n) => `최소 ${n}개`,
    max: (n) => `최대 ${n}개`,
    noMore: '그 이상은 효과 없음',
    moreIsFine: '더 모아도 좋음',
  },
  items: {
    search: (count) => `아이템 ${count}개 검색 (이름·효과)`,
    all: '전체',
    tiers: '등급',
    noResults: '검색 결과가 없습니다.',
    sort: { rank: '티어순', popularity: '많이 쓰는 순', name: '이름순' },
    topOnly: 'S·A만',
    inBuilds: '이 아이템을 쓰는 영웅 빌드',
    inCombos: '이 아이템을 쓰는 테마 빌드',
  },
  rating: {
    rank: (rank) => `같은 등급 중 ${rank}티어`,
    popularity: {
      'very-high': '거의 항상 챙김',
      high: '인기',
      medium: '무난히 쓰임',
      low: '마니아용',
      rare: '거의 안 씀',
    },
    popularTag: '인기',
    bestFor: '특히 좋은 요원',
  },
  search: { survivors: '영웅', items: '아이템', builds: '빌드' },
  combos: {
    title: '테마 빌드',
    search: '빌드나 영웅 검색',
    intro: '최적 빌드 말고 재미로 노리는 아이템 조합입니다. 프린터, 성소, 달 포드에서 이 테마를 따라 모아 보세요.',
    all: '전체',
    focus: { survivor: '영웅', items: '아이템', equipment: '장비', challenge: '도전' },
    tags: { theme: '테마', chaos: '혼돈', challenge: '도전', solo: '솔로', team: '팀플', 'long-run': '장기전' },
    anyone: '아무 생존자나',
    fits: '잘 맞는 생존자',
    items: '모을 아이템',
    equipment: '장비',
    avoid: '피할 아이템',
    whyFun: '재미 포인트',
  },
  survivorRating: {
    rank: (rank) => `${rank}티어`,
    difficulty: { easy: '조작 쉬움', medium: '조작 보통', hard: '조작 어려움' },
    strengths: '강점',
    weaknesses: '약점',
    order: { default: '기본순', rank: '티어순' },
  },
  recommended: {
    title: '이 요원이 특히 좋아하는 아이템',
    hint: '트리 밖에서도, 이 요원에게 특히 잘 맞는 아이템을 티어순으로 모았습니다.',
  },
  summary: {
    empty: '메인 앱의 빌드 탭에서 따라갈 빌드를 고르면 여기에 요약이 표시됩니다.',
    earlyCore: '초반 핵심',
    nextBranches: '다음 분기',
  },
  phases: { early: '초반', mid: '중반', late: '후반', loop: '루프 이후' },
  slots: { primary: '주 스킬', secondary: '보조 스킬', utility: '유틸리티', special: '특수 스킬' },
  difficulty: { beginner: '입문', intermediate: '중급', advanced: '고급' },
  priority: { core: '핵심', optional: '선택', situational: '상황' },
  tiers: {
    common: '일반',
    uncommon: '고급',
    legendary: '전설',
    boss: '보스',
    lunar: '달',
    void: '공허',
    meal: '요리',
    equipment: '장비',
    'lunar-equipment': '달 장비',
    'elite-equipment': '엘리트 장비',
  },
  dlc: {
    base: '기본',
    sotv: 'Survivors of the Void',
    sots: 'Seekers of the Storm',
    ac: 'Alloyed Collective',
  },
};

export const MESSAGES: Record<Locale, Ror2Messages> = { en, ko };

export function useT(): Ror2Messages {
  return MESSAGES[useGameUi().locale];
}
