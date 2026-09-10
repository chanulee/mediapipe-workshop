import { clamp, mapRange } from '../lib/utils.js';
export const steps = [
  { title: '카메라를 켜세요.', detail: '허용 버튼을 누르면 내 모습이 보여요.', icon: '✋', control: 'camera', event: 'ready' },
  { title: '두 손을 보여주세요.', detail: '손 전체가 보이도록 조금 뒤로 가보세요.', icon: '🙌', event: 'hands' },
  { title: '두 손을 천천히 벌려보세요.', detail: '그림이 커지나요? 다시 모으면 어떻게 될까요?', icon: '↔', event: 'spread' },
  { title: '더 많이 변하게 해볼까요?', detail: '슬라이더를 오른쪽으로 움직여보세요.', icon: '＋', control: 'amount', event: 'amount' },
  { title: '이번에는 반대로!', detail: '“반대로”를 누르고 두 손을 벌려보세요. 무엇이 달라졌나요?', icon: '⇄', control: 'direction', event: 'reverse' },
  { title: '내 그림을 넣어보세요.', detail: '내 사진이나 그림을 골라요. 준비된 그림을 써도 좋아요.', icon: '▧', control: 'image', event: 'image' },
  { title: '다른 반응을 골라보세요.', detail: '“커지기” 대신 “빙글 돌기”를 골라 손을 움직여보세요.', icon: '✳', control: 'effect', event: 'effect' },
  { title: '어떤 반응이 더 재미있나요?', detail: '손을 모았다 벌리며 지금 고른 반응을 살펴보세요.', icon: '✦', event: 'compare' },
];
export function completes(step, event, value) {
  if (steps[step]?.event !== event) return false;
  if (event === 'hands') return value >= 2;
  if (event === 'spread') return value >= 0.18;
  if (event === 'amount') return value >= 80;
  if (event === 'effect') return value !== 'size';
  return true;
}
export function reaction(distance, sensitivity, reverse, amount, effect) {
  let value = clamp(mapRange(distance, 0.08, 0.7, 0, 1) * sensitivity);
  if (reverse) value = 1 - value;
  const strength = amount / 100;
  return { value, size: effect === 'size' ? 90 + value * strength * 440 : 230,
    angle: effect === 'rotate' ? value * strength * Math.PI * 2 : 0,
    opacity: effect === 'opacity' ? 1 - strength + value * strength : 1,
    shake: effect === 'shake' ? value * strength * 35 : 0 };
}
