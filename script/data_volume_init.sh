#!/bin/bash data_volume init

PRISMA_SCHEMA="/app/prisma/schema.prisma"
PRISMA_DB="/app/data_volume/dev.db"
ICONS_PATH="/app/data_volume/icons"

# 检查 schema 文件是否存在，作为判断是否初始化过的依据
if [ -f "$PRISMA_DB" ] && [ -d "$ICONS_PATH" ]; then
    # deploy migrate to db
    npx prisma migrate deploy
    echo "already init. migrate end."
else
    echo "start init prisma."
    # create db
    npx prisma migrate dev --name "init"
    # # create seed data
    # npx prisma db seed
    # create `icons` dir 
    mkdir -p /app/data_volume/icons

    echo "volume init successful!"
fi
