#!/usr/bin/env bash
set -euo pipefail

ROOT="真实实现工程/01_基础工程骨架"
export PYTHONPATH="$ROOT/01_后端服务骨架/src:$ROOT/02_配置管理/src:$ROOT/03_日志与监控/src:$ROOT/04_Secret引用/src"

python -m pytest \
  "$ROOT/01_后端服务骨架/tests" \
  "$ROOT/02_配置管理/tests" \
  "$ROOT/03_日志与监控/tests" \
  "$ROOT/04_Secret引用/tests" \
  -q
