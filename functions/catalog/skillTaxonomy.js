const CANONICAL_SKILLS = [
  "branding",
  "logo_design",
  "brand_guidelines",
  "social_media",
  "instagram_posts",
  "carousel_design",
  "poster_design",
  "flyer_design",
  "brochure_design",
  "presentation_design",
  "pitch_decks",
  "billboard_design",
  "banner_design",
  "rollup_banner",
  "signage_design",
  "event_materials",
  "packaging_design",
  "label_design",
  "tshirt_design",
  "cap_design",
  "sticker_design",
  "digital_ads",
  "youtube_thumbnails",
  "email_design",
];

const SKILL_ALIASES = {
  brand_systems: "brand_guidelines",
  brand_strategy: "branding",
  social_media_design: "social_media",
  thumbnail_design: "youtube_thumbnails",
  ad_design: "digital_ads",
  digital_marketing: "digital_ads",
  web_design: "banner_design",
  print_design: "flyer_design",
  editorial_design: "brochure_design",
  event_design: "event_materials",
  merch_design: "tshirt_design",
  signage_design: "signage_design",
  packaging_design: "packaging_design",
  label_design: "label_design",
  email_design: "email_design",
  banner_design: "banner_design",
  outdoor_advertising: "billboard_design",
};

function normalizeSkillTags(skills = []) {
  if (!Array.isArray(skills)) return [];

  const mapped = skills
      .map((skill) => String(skill || "").trim().toLowerCase())
      .filter(Boolean)
      .map((skill) => SKILL_ALIASES[skill] || skill)
      .filter((skill) => CANONICAL_SKILLS.includes(skill));

  return [...new Set(mapped)];
}

module.exports = {
  CANONICAL_SKILLS,
  normalizeSkillTags,
};
