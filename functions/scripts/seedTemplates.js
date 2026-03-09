/* eslint-disable no-console */
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const STARTER_TEMPLATES = [
  {
    title: "Social Post",
    category: "social_post",
    description: "A clean, on-brand single social media post for any platform.",
    tags: ["social media", "brand awareness", "engagement"],
    suggestedBrief: "Create a single social media post that highlights our brand message.\n\nBrand colours and logo must be included.\nTarget audience: [describe your audience]\nKey message: [your message]\nCall to action: [e.g. Visit our website / Follow us / Shop now]\nPlatform: [Instagram / Facebook / LinkedIn / Twitter]",
  },
  {
    title: "Carousel Post",
    category: "carousel",
    description: "A multi-slide carousel that tells a story or walks through a concept step by step.",
    tags: ["carousel", "multi-slide", "storytelling", "education"],
    suggestedBrief: "Design a carousel with 3–5 slides that tells a story or explains a concept step by step.\n\nSlide 1 should hook the audience.\nFinal slide must include a strong call to action.\nBrand colours and fonts must be consistent throughout.\nTopic / story arc: [describe each slide's focus]",
  },
  {
    title: "Promo Banner",
    category: "social_post",
    description: "A bold promotional banner to announce a sale, discount, or special offer.",
    tags: ["promotion", "discount", "sale", "banner", "offer"],
    suggestedBrief: "Create a promotional banner for our offer.\n\nProduct or service on offer: [details]\nDiscount or deal: [e.g. 20% off, Buy 1 Get 1]\nValidity period: [start date – end date]\nHighlight the main benefit. The offer should be the visual hero.\nBrand palette and logo required.",
  },
  {
    title: "Product Launch Graphic",
    category: "social_post",
    description: "An eye-catching announcement graphic for a new product or service going live.",
    tags: ["product launch", "new product", "announcement", "reveal"],
    suggestedBrief: "Design a product launch announcement graphic.\n\nProduct name: [name]\nKey features to highlight: [feature 1, feature 2, feature 3]\nLaunch date: [date]\nTone: [exciting / professional / minimal]\nThe product image or illustration should be the visual centrepiece.\nInclude our logo and brand colours.",
  },
  {
    title: "Event Poster",
    category: "flyer",
    description: "A high-impact poster for an event — conference, workshop, party, or community gathering.",
    tags: ["event", "poster", "announcement", "invitation", "conference"],
    suggestedBrief: "Design a poster for our upcoming event.\n\nEvent name: [name]\nDate and time: [details]\nVenue: [location or online link]\nKey speakers or highlights: [optional]\nTone: [formal / festive / corporate / creative]\nInclude our logo and registration or contact info.",
  },
  {
    title: "Testimonial Graphic",
    category: "social_post",
    description: "A credibility-building graphic that features a client quote or review.",
    tags: ["testimonial", "social proof", "quote", "review", "trust"],
    suggestedBrief: "Create a testimonial graphic featuring a client quote.\n\nQuote: \"[paste the testimonial here]\"\nClient name and title: [details]\nDesign should feel warm and credible.\nBrand colours as a backdrop; the quote as the focal point.\nOptional: include client photo or avatar placeholder.",
  },
  {
    title: "Corporate Announcement",
    category: "social_post",
    description: "A professional graphic for sharing company news, milestones, or official statements.",
    tags: ["corporate", "announcement", "official", "news", "milestone"],
    suggestedBrief: "Design a corporate announcement graphic.\n\nAnnouncement topic: [e.g. new partnership, award, milestone, leadership update]\nKey details to include: [details]\nTone: professional and authoritative.\nMust include company logo and maintain brand standards.",
  },
  {
    title: "Holiday Campaign Graphic",
    category: "social_post",
    description: "A festive seasonal graphic for holiday campaigns and cultural moments.",
    tags: ["holiday", "seasonal", "festive", "campaign", "celebration"],
    suggestedBrief: "Create a festive graphic for the upcoming holiday or season.\n\nHoliday or occasion: [e.g. Eid, Christmas, New Year, Diwali, Ramadan]\nKey message: [e.g. Wishing you a joyful Eid]\nBrand voice for this campaign: [warm and celebratory / subtle and elegant]\nInclude our logo. Festive elements should align with our brand aesthetic.",
  },
  {
    title: "Price Promo Graphic",
    category: "social_post",
    description: "A bold pricing or discount graphic designed to drive conversions.",
    tags: ["pricing", "promotion", "offer", "discount", "conversion"],
    suggestedBrief: "Design a price promotional graphic.\n\nProduct or service: [details]\nPrice or discount to highlight: [e.g. Starting from KES 1,500 / Save 30%]\nUrgency element (if any): [e.g. Limited time / Today only]\nThe price should be the visual hero.\nClean, bold, and action-oriented design. Include logo.",
  },
  {
    title: "Recruitment Post",
    category: "social_post",
    description: "A professional hiring post to attract candidates for an open role.",
    tags: ["recruitment", "hiring", "jobs", "HR", "careers"],
    suggestedBrief: "Create a recruitment post graphic for a job opening.\n\nPosition: [job title]\nKey requirements or highlights: [2–3 bullet points]\nHow to apply: [email / link]\nApplication deadline (if any): [date]\nTone: professional but approachable.\nInclude company logo and brand colours.",
  },
  {
    title: "Story Ad",
    category: "social_post",
    description: "A vertical 9:16 story-format ad for Instagram or Facebook Stories.",
    tags: ["story", "instagram", "facebook", "vertical", "ad", "9:16"],
    suggestedBrief: "Design a vertical story-format ad at 9:16 ratio.\n\nCampaign goal: [brand awareness / drive traffic / promote offer]\nKey message (must land in 3 seconds): [short punchy text]\nCall to action: [e.g. Swipe up / Learn more / Shop now]\nBrand colours and logo must be present.\nKeep text minimal — let visuals lead.",
  },
  {
    title: "Flyer",
    category: "flyer",
    description: "A versatile A4 or A5 flyer for print or digital distribution.",
    tags: ["flyer", "print", "A4", "physical", "digital", "handout"],
    suggestedBrief: "Design a flyer (A4 or A5 format, print or digital).\n\nPurpose: [e.g. event promotion / product launch / service listing]\nHeadline: [main message]\nKey details to include: [what, when, where, how to contact]\nVisual style: [bold and colourful / clean and minimal / professional]\nOur logo and brand colours must be used.",
  },
];

async function seedTemplates() {
  const existingSnap = await db.collection("briefingTemplates")
      .where("source", "==", "seed")
      .limit(1)
      .get();

  if (!existingSnap.empty) {
    console.log("Seed templates already present. Skipping.");
    return {skipped: true};
  }

  const batch = db.batch();

  for (const template of STARTER_TEMPLATES) {
    const ref = db.collection("briefingTemplates").doc();
    batch.set(ref, {
      ...template,
      usageCount: 0,
      status: "active",
      source: "seed",
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  console.log(`Seeded ${STARTER_TEMPLATES.length} starter templates.`);
  return {seeded: STARTER_TEMPLATES.length};
}

seedTemplates()
    .then((result) => {
      if (result.skipped) {
        console.log("Nothing to do — seed already ran.");
      } else {
        console.log(`Done. ${result.seeded} templates written to briefingTemplates.`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
