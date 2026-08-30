#!/usr/bin/env bash
set -euo pipefail

ROOT="真实实现工程/01_基础工程骨架"
export PYTHONPATH="$ROOT/01_后端服务骨架/src:$ROOT/02_配置管理/src:$ROOT/03_日志与监控/src:$ROOT/04_Secret引用/src:$ROOT/06_运行时集成/src:$ROOT/07_健康与只读门禁/src:$ROOT/08_配置强验证/src"

python -m pytest \
  "$ROOT/01_后端服务骨架/tests" \
  "$ROOT/02_配置管理/tests" \
  "$ROOT/03_日志与监控/tests" \
  "$ROOT/04_Secret引用/tests" \
  "$ROOT/06_运行时集成/tests" \
  "$ROOT/07_健康与只读门禁/tests" \
  "$ROOT/08_配置强验证/tests" \
  -q
