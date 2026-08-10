'use client';
import { useFormStatus } from 'react-dom';

// 提交中把按钮禁用并换文案。没有这个反馈时，点完删除到列表刷新之间
// 界面完全没有变化，即使服务端只花几十毫秒，用起来也像卡住了。
// 必须是独立组件：useFormStatus 只能读到父级 <form> 的状态。
export function SubmitButton({
  children, pendingText, className, title,
}: {
  children: React.ReactNode;
  pendingText?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} title={title} className={className}>
      {pending ? pendingText ?? children : children}
    </button>
  );
}
