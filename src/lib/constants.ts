export const BOARD_KINDS = [
  { value: 'LOVER', label: '恋人', emoji: '💗' },
  { value: 'FAMILY', label: '家人', emoji: '🏠' },
  { value: 'FRIEND', label: '朋友', emoji: '🤝' },
  { value: 'OTHER', label: '其他', emoji: '✨' },
] as const;

export function kindLabel(kind: string) {
  return BOARD_KINDS.find((k) => k.value === kind) ?? BOARD_KINDS[3];
}

// 单张照片体积上限。这条链路上还有两道更宽松的闸门：
// next.config.mjs 的 serverActions.bodySizeLimit(10mb)、Nginx 的
// client_max_body_size(12M)。上限必须是这里最小，否则请求会先被网关掐断，
// 前端只能看到一句没头没尾的 Application error。
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_LABEL = '8MB';

// 留言墙一次渲染的条数上限
export const MESSAGE_PAGE_SIZE = 30;
