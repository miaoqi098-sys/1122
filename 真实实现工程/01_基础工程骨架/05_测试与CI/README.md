# 05 测试与CI

## 职责
为 P1 基础工程骨架建立机器可验证测试入口，并统一回测 01～04 四个已实现功能文件夹。

## V1范围
- Python 3.12；
- 安装 FastAPI / Pydantic / httpx / pytest；
- 把四个功能文件夹的 `src` 加入 `PYTHONPATH`；
- 运行四组 pytest；
- workflow 只做测试，不部署、不读取生产Secret、不进行Amazon连接。

## 文件
- `run_p1_tests.sh`：统一测试入口；
- `.github/workflows/real-v1-p1-ci.yml`：GitHub Actions机器执行入口（仓库级CI文件，归属本功能文件夹施工）。

## 完成条件
只有 GitHub Actions 对 `implementation/real-v1` 当前exact head执行成功，才可把 P1-01～P1-05机器状态标记为PASS。
