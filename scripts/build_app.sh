#!/bin/bash

PLATFORM=""

# 解析具名参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--platform)
      PLATFORM="$2"
      shift 2
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

if [ -z "$PLATFORM" ]; then
    echo "请指定平台参数，例如: --platform win 或 -p mac"
    echo "可选值：win、mac、linux"
    exit 1
fi

# 获取项目根目录和脚本目录
script_dir=$(dirname "$0")
project_dir=$(cd "$script_dir/.." && pwd)

# 从项目根目录执行Python构建脚本
cd "$project_dir" || exit 1

# 执行Python构建脚本并检查结果
echo "开始构建Python服务..."
bash "$script_dir/build_python.sh"
if [ $? -ne 0 ]; then
    echo "Python服务构建失败，终止打包流程"
    exit 1
fi
echo "Python服务构建成功，继续执行打包操作"

# 确保在正确目录下执行后续命令
cd "$project_dir" || exit 1

cur=$(pwd)

echo "当前目录：$cur"


# 根据平台执行相应命令
if [ "$PLATFORM" = "win" ]; then
    npm run package:win
fi

if [ "$PLATFORM" = "mac" ]; then
    npm run package:mac
fi

if [ "$PLATFORM" = "linux" ]; then
    echo "Linux打包功能尚未实现"
    exit 1
fi
