#!/bin/sh
set -e

echo "⏳ 等待数据库就绪并同步表结构…"
# prisma db push 自带重试连接；失败则最多重试几次
n=0
until npx prisma db push --skip-generate --accept-data-loss; do
  n=$((n+1))
  if [ "$n" -ge 10 ]; then
    echo "❌ 数据库连接失败，已重试 $n 次，退出。"
    exit 1
  fi
  echo "数据库还没准备好，5 秒后重试（第 $n 次）…"
  sleep 5
done

echo "✅ 表结构已同步，启动应用。"
exec "$@"
