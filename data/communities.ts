export type CommunityItem = {
  area: string;
  community: string;
  multiplier: number; // 核心：小区价格校准系数
};

export const COMMUNITIES: CommunityItem[] = [
  // Dubai Marina
  { area: "Dubai Marina", community: "Marina Gate", multiplier: 1.22 },
  { area: "Dubai Marina", community: "Emaar 6 Towers", multiplier: 1.18 },
  { area: "Dubai Marina", community: "Marina Promenade", multiplier: 1.15 },
  { area: "Dubai Marina", community: "Princess Tower", multiplier: 1.05 },

  // Downtown
  { area: "Downtown Dubai", community: "Burj Khalifa", multiplier: 1.35 },
  { area: "Downtown Dubai", community: "Burj Views", multiplier: 1.15 },
  { area: "Downtown Dubai", community: "29 Boulevard", multiplier: 1.10 },

  // JVC
  { area: "Jumeirah Village Circle", community: "Binghatti Residences", multiplier: 0.95 },
  { area: "Jumeirah Village Circle", community: "Oxford Residences", multiplier: 0.98 },
  { area: "Jumeirah Village Circle", community: "Five JVC", multiplier: 1.05 },

  // ……（我会直接给你 60–100 个主流社区）
];