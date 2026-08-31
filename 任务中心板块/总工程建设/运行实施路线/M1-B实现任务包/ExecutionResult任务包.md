# ExecutionResult 实现任务包 V1

> 覆盖：R-GP-017（结果标准化部分）

## 1. 目标
把不同平台的调用结果标准化为唯一 ExecutionResult 语义，使上层无需理解每个API的细节。

## 2. 最小字段语义
- execution_result_id
- action_id
- task_id
- executor_adapter
- platform_request_ref
- started_at / completed_at
- status: success / failed / partial / unknown
- before_value / requested_value / observed_after_value
- error_code / error_category
- retryability
- rollback_possible
- raw_evidence_ref

## 3. 状态规则
- HTTP/API成功不自动等于业务Action完全成功；必须根据目标资源回读/平台返回判断。
- timeout且结果未知 → unknown，不自动记failed或success。
- 部分批量结果 → partial，并拆分子结果或明确失败项。

## 4. 错误分类
至少区分：auth、permission、validation、rate_limit、network、platform_reject、conflict、unknown。

## 5. 验收条件
- 不同Adapter输出相同核心语义；
- unknown结果不会盲目重试造成重复写；
- 所有结果能回查Action/Task；
- raw平台证据与标准化结果分离；
- Validation只消费标准化ExecutionResult和后续Metric，不直接解析平台响应。

## 6. 静态L1
执行结果语义、unknown/partial处理和错误标准化已明确。L1：PASS。