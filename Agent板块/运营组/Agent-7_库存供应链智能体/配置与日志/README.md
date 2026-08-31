# 配置与日志

## 配置项
- 默认需求窗口及加权方式；
- lead time分段参数与P50/P90；
- safety stock安全缓冲；
- reorder point策略；
- 低覆盖/断货/积压/库龄阈值；
- 在途ETA置信度规则；
- 供应商/线路版本；
- 库龄分段；
- 数据新鲜度最低要求。

## 版本规则
任何会改变补货判断的配置必须记录版本：`config_version`、`effective_from`、`changed_fields`、`reason`、`source`。供应周期或安全缓冲变化后，相关库存覆盖和补货建议必须重算或失效。

## 日志
至少记录：
- analysis_id / event_id / response_id；
- scope；
- inventory_snapshot_ref；
- demand_baseline_ref；
- lead_time_version；
- inbound_refs；
- calculation_time；
- 关键假设；
- 数据缺失；
- 置信度；
- 输出结论与升级对象。

## 审计原则
库存建议必须能回溯到当时的库存快照、销量基线、在途状态和供应周期版本。禁止只保留最终补货数量而丢失计算条件。
