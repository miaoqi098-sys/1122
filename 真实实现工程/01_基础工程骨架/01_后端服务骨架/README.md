# P1-01 后端服务骨架

## 职责
提供第一批真实实现的统一HTTP服务入口和健康检查，不承载具体Amazon业务逻辑。

## 技术基线
- Python >= 3.12
- FastAPI
- Pydantic v2
- Uvicorn
- pytest
- httpx（测试客户端）

## 当前实现
- `src/app/main.py`：应用入口
- `GET /health`：最小健康检查
- `GET /version`：返回服务与契约阶段信息
- `tests/test_health.py`：基础接口测试

## 边界
- 不读取任何Amazon Secret；
- 不连接Amazon API；
- 不连接数据库；
- 不产生经营写操作；
- 配置、日志、Secret、CI分别在P1后续独立文件夹施工。

## L1完成条件
- 包结构与依赖声明存在；
- 应用工厂可导入；
- 健康检查具有稳定响应Contract；
- 测试覆盖health/version基础行为；
- 后续模块可通过Router挂载而无需改写应用核心。
