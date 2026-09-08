(() => {
  const modules = [
    {
      id: 'selection', label: '选品', route: '/selection', source_path: '选品板块/',
      file_count: 1, readiness: 'DESIGN_ONLY', owner: '选品业务',
      summary: '承载选品业务能力与后续工作流；二级架构仍待业务确认。',
      live_surfaces: [], planned_surfaces: ['市场机会', '容量与竞争', '利润门槛', '候选商品决策']
    },
    {
      id: 'operations', label: '运营', route: '/operations', source_path: '运营板块/',
      file_count: 36, readiness: 'PARTIAL_LIVE', owner: '运营工作台',
      summary: '产品、广告、库存、竞品和站外推广的统一经营入口。',
      live_surfaces: ['21 个产品状态', 'Amazon Ads Profiles / Campaigns / Ad Groups'],
      planned_surfaces: ['库存补货决策', '竞品实体', '站外归因']
    },
    {
      id: 'sandbox', label: '沙盘演练', route: '/sandbox', source_path: '沙盘演练板块/',
      file_count: 1, readiness: 'DESIGN_ONLY', owner: '经营实验室',
      summary: '围绕我方产品数字孪生进行可审计的 Low / Base / High 情景推演。',
      live_surfaces: [], planned_surfaces: ['Frozen Twin', 'R0 基线', 'Response Packages', 'Revised Strategy']
    },
    {
      id: 'governance', label: '系统政策边界', route: '/governance', source_path: '政策边界板块/',
      file_count: 3, readiness: 'CONTRACT_READY', owner: '系统治理',
      summary: '定义权限、审批、自动化、安全与 fail-closed 公共边界。',
      live_surfaces: ['Bootstrap 只读与执行权限标记'], planned_surfaces: ['身份与角色策略', '审批策略管理']
    },
    {
      id: 'amazon-boundary', label: '亚马逊经营边界探索', route: '/amazon-boundary', source_path: '亚马逊政策边界/',
      file_count: 16, readiness: 'LIVE_READ', owner: 'Amazon 边界情报',
      summary: 'APR 市场观察、AOM 正向方法与 APB 政策证据的分层入口。',
      live_surfaces: ['APR', 'AOM', 'APB'], planned_surfaces: ['Policy Diff 自动刷新', '商品影响联动']
    },
    {
      id: 'agents', label: 'Agent', route: '/agents', source_path: 'Agent板块/',
      file_count: 572, readiness: 'PARTIAL_LIVE', owner: 'Agent 运行体系',
      summary: 'Agent-1 至 Agent-13 的角色工程与共享运行基础设施。',
      live_surfaces: ['4 个运行事实组件'], planned_surfaces: ['专业 Agent 2-13 完整运行视图', 'Decision / Task 追溯']
    },
    {
      id: 'skills', label: '技能', route: '/skills', source_path: '技能板块/',
      file_count: 3, readiness: 'CONTRACT_READY', owner: '能力与工具契约',
      summary: '系统与 Agent 可复用的能力单元、工具机制及权限边界。',
      live_surfaces: [], planned_surfaces: ['Skill Registry', '工具健康状态', '调用审计']
    },
    {
      id: 'connectors', label: '对外连接', route: '/connectors', source_path: '对外连接板块/',
      file_count: 68, readiness: 'PARTIAL_LIVE', owner: '外部连接层',
      summary: 'Cloudflare、Amazon SP-API、Amazon Ads、SIF、Email 与开发通道。',
      live_surfaces: ['Cloudflare', 'Amazon SP-API', 'Amazon Ads', 'SIF'],
      planned_surfaces: ['Email Secret 配置', 'Codex 公共健康端点']
    },
    {
      id: 'tasks', label: '任务中心', route: '/tasks', source_path: '任务中心板块/',
      file_count: 75, readiness: 'LIVE_EMPTY', owner: '受控执行链',
      summary: 'Decision 到 Outcome 的任务、审批、权限、调度与结果追踪。',
      live_surfaces: ['D1 Tasks 只读列表'], planned_surfaces: ['审批工作台', '执行结果回写']
    },
    {
      id: 'knowledge', label: '知识', route: '/knowledge', source_path: '知识板块/',
      file_count: 46, readiness: 'LIVE_READ', owner: '可检索认知层',
      summary: '统一检索政策、方法、市场观察、案例、工程与决策知识。',
      live_surfaces: ['D1 Knowledge Search'], planned_surfaces: ['语义检索', '证据图谱', '知识老化']
    },
    {
      id: 'memory', label: '记忆', route: '/memory', source_path: '记忆板块/',
      file_count: 2, readiness: 'CONTRACT_READY', owner: '对象历史',
      summary: '保存产品、任务、决策、实验、操作与结果的对象级历史。',
      live_surfaces: [], planned_surfaces: ['对象时间线', '决策原因追溯', '结果复盘']
    },
    {
      id: 'data', label: '数据', route: '/data', source_path: '数据板块/',
      file_count: 204, readiness: 'LIVE_READ', owner: '系统事实层',
      summary: 'Canonical Model、D1 事实、KV 当前状态、来源与新鲜度。',
      live_surfaces: ['1122-core D1', '11 个来源状态', '产品 / Agent / Task / Knowledge 读模型'],
      planned_surfaces: ['R2 原始档案', '数据质量告警']
    },
    {
      id: 'ui-design', label: 'UI 设计与契约', route: '/system/ui-design', source_path: 'UI界面设计板块/',
      file_count: 19, readiness: 'CONTRACT_READY', owner: '系统支撑',
      summary: '统一导航、页面路由、读模型与产品视图契约。',
      live_surfaces: ['Navigation Registry V2', 'Web Console'], planned_surfaces: ['更多页面契约落地']
    },
    {
      id: 'conflicts', label: '系统冲突问题库', route: '/system/conflicts', source_path: '系统冲突问题库/',
      file_count: 15, readiness: 'TRACKED', owner: '系统支撑',
      summary: '跨模块冲突从发现、分析、修复、验证到关闭的可追溯登记。',
      live_surfaces: ['13 条冲突索引'], planned_surfaces: ['7 条已确认问题闭环', '1 条待验证']
    }
  ];

  window.__1122_SYSTEM_CATALOG__ = Object.freeze({
    schema_version: '1.0.0',
    scanned_at: '2026-09-08',
    scan_commit: '00b1ebb',
    repository: Object.freeze({
      owner: 'miaoqi098-sys', name: '1122', visibility: 'private',
      architecture: '12 + 1 + 1', tracked_files_at_scan: 1172,
      engineering_support: Object.freeze({ github_files: 84, tools_files: 9, web_console_files: 13 })
    }),
    cloudflare: Object.freeze({
      observed_at: '2026-09-08',
      pages: Object.freeze(['1122-web-agent', 'sorilo-uk']),
      workers: Object.freeze([
        '1122-cloudflare-bridge', '1122-amazon-ads-bridge', '1122-amazon-sp-api-bridge',
        '1122-sif-bridge', '1122-email-bridge', '1122-data-layer'
      ]),
      kv: Object.freeze(['PRODUCT_STATE']),
      d1: Object.freeze({ name: '1122-core', evidence: 'runtime-binding', account_list_status: 'permission-limited' }),
      r2: Object.freeze({ enabled: false, bucket_count: 0 })
    }),
    modules: Object.freeze(modules.map(item => Object.freeze(item)))
  });
})();
