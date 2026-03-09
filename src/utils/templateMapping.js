const TEMPLATE_CATEGORY_TO_SERVICE_CATEGORY = {
  social_post: 'social_media',
  carousel: 'social_media',
  flyer: 'marketing_materials',
  branding: 'branding',
  presentation: 'marketing_materials',
  general: 'social_media',
}

const TEMPLATE_CATEGORY_TO_DELIVERABLE = {
  social_post: 'instagram_post',
  carousel: 'instagram_carousel',
  flyer: 'flyer_design',
  branding: 'brand_identity_kit',
  presentation: 'company_profile',
  general: 'instagram_post',
}

function pickLabeledLine(text, labels = []) {
  const source = String(text || '')
  if (!source) return ''
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean)
  for (const line of lines) {
    for (const label of labels) {
      const re = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'i')
      const match = line.match(re)
      if (match?.[1]) return match[1].trim()
    }
  }
  return ''
}

export function mapTemplateToForm(template) {
  const category = TEMPLATE_CATEGORY_TO_SERVICE_CATEGORY[template?.category] || 'social_media'
  const deliverableId = TEMPLATE_CATEGORY_TO_DELIVERABLE[template?.category] || 'instagram_post'

  const suggestedBrief = String(template?.suggestedBrief || '').trim()
  const projectOverview = String(template?.description || template?.title || '').trim()
  const targetAudience = pickLabeledLine(suggestedBrief, ['Target audience', 'Audience'])
  const keyMessage = pickLabeledLine(suggestedBrief, ['Key message', 'Message']) || String(template?.title || '').trim()
  const usagePlatform = pickLabeledLine(suggestedBrief, ['Platform', 'Platform or media'])
  const otherNotes = suggestedBrief

  const templateSnapshot = {
    title: template?.title || '',
    category: template?.category || 'general',
    suggestedBrief,
    description: template?.description || '',
    tags: Array.isArray(template?.tags) ? template.tags : [],
  }

  return {
    category,
    deliverableId,
    title: template?.title || '',
    description: template?.description || '',
    projectOverview,
    targetAudience,
    keyMessage,
    usagePlatform,
    otherNotes,
    templateId: template?.id || null,
    templateSnapshot,
  }
}
