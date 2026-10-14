export type VideoFormat = 'story' | 'square' | 'wide'

export const VIDEO_SIZES: Record<VideoFormat, { w: number; h: number; label: string; hint: string }> = {
  story: { w: 1080, h: 1920, label: 'Vertical 9:16', hint: 'Reels, Stories, TikTok, Shorts' },
  square: { w: 1080, h: 1080, label: 'Quadrado 1:1', hint: 'Feed do Instagram, X' },
  wide: { w: 1920, h: 1080, label: 'Horizontal 16:9', hint: 'YouTube, X' },
}
