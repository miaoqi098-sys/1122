// AUTO-GENERATED from UI界面设计板块/NavigationRegistry.v2.json. DO NOT EDIT.
// source-sha256: 45f188c0c76194ff
(() => {
  const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };
  const registry = {
  "version": "2.1.0",
  "source_schema_version": "2.1.0",
  "home_route": "/command-center",
  "modules": [
    {
      "id": "command-center",
      "label": "经营指挥中心",
      "route": "/command-center",
      "source_path": "web-console/index.html",
      "icon": "◈",
      "kind": "dashboard",
      "nav_group": "overview",
      "readiness": "LIVE_READ",
      "summary": "统一查看经营、数据和连接健康状态。",
      "legacy_source": "index.html"
    },
    {
      "id": "selection",
      "label": "选品",
      "route": "/selection",
      "source_path": "选品板块/",
      "enabled": true,
      "icon": "◉",
      "kind": "module",
      "nav_group": "business",
      "readiness": "DESIGN_ONLY",
      "summary": "市场机会、容量、竞争、利润与新品机会评估。"
    },
    {
      "id": "operations",
      "label": "运营",
      "route": "/operations",
      "source_path": "运营板块/",
      "enabled": true,
      "icon": "▦",
      "kind": "group",
      "nav_group": "business",
      "readiness": "PARTIAL_LIVE",
      "summary": "产品、广告、库存、竞品与站外经营。"
    },
    {
      "id": "products",
      "label": "产品",
      "route": "/operations/products",
      "parent": "operations",
      "source_path": "运营板块/产品板块/",
      "kind": "module",
      "readiness": "LIVE_READ",
      "summary": "产品状态、流量转化、价格、利润与体验。"
    },
    {
      "id": "inventory-logistics",
      "label": "库存物流",
      "route": "/operations/inventory-logistics",
      "parent": "operations",
      "source_path": "运营板块/库存物流板块/",
      "kind": "module",
      "readiness": "PARTIAL_LIVE",
      "summary": "库存覆盖、在途与 FBA 只读状态。",
      "connectors": [
        "amazon-sp-api"
      ]
    },
    {
      "id": "offsite",
      "label": "站外推广",
      "route": "/operations/offsite",
      "parent": "operations",
      "source_path": "运营板块/站外推广板块/",
      "kind": "module",
      "readiness": "DESIGN_ONLY",
      "summary": "站外渠道、红人合作、活动与归因。",
      "legacy_source": "运营板块/站外推广板块/01_品牌官网与独立站/01_API资质官网/site/index.html"
    },
    {
      "id": "competitors",
      "label": "竞品",
      "route": "/operations/competitors",
      "parent": "operations",
      "source_path": "运营板块/竞品板块/",
      "kind": "module",
      "readiness": "PARTIAL_LIVE",
      "summary": "竞品池、SIF 流量词、去重词库、分类与市场信号。",
      "connectors": [
        "sif"
      ]
    },
    {
      "id": "competitor-keywords",
      "label": "竞品关键词工作台",
      "route": "/operations/competitors/keywords",
      "parent": "competitors",
      "source_path": "运营板块/竞品板块/",
      "view_contract": "UI界面设计板块/竞品关键词工作台/CompetitorKeywordWorkbenchView.schema.json",
      "kind": "module",
      "readiness": "PARTIAL_LIVE",
      "summary": "批量 ASIN → SIF 分页流量词 → 严格去重 → 10 类分类 → D1 可追溯词库。",
      "connectors": [
        "sif"
      ]
    },
    {
      "id": "ads",
      "label": "广告",
      "route": "/operations/ads",
      "parent": "operations",
      "source_path": "运营板块/广告板块/",
      "kind": "module",
      "readiness": "PARTIAL_LIVE",
      "summary": "Amazon Ads 的实时 Profiles、Campaigns、Ad Groups，以及人工确认的 Campaign 状态切换。",
      "connectors": [
        "amazon-ads"
      ]
    },
    {
      "id": "sandbox",
      "label": "沙盘演练",
      "route": "/sandbox",
      "source_path": "沙盘演练板块/",
      "enabled": true,
      "icon": "◇",
      "kind": "module",
      "nav_group": "automation",
      "readiness": "DESIGN_ONLY",
      "summary": "经营情景、反事实基线和策略推演。"
    },
    {
      "id": "internal-policy",
      "label": "系统政策边界",
      "route": "/governance",
      "source_path": "政策边界板块/",
      "enabled": true,
      "icon": "⌘",
      "kind": "module",
      "nav_group": "system",
      "readiness": "CONTRACT_READY",
      "summary": "权限、审批、自动化、安全和 fail-closed 规则。"
    },
    {
      "id": "amazon-boundary",
      "label": "亚马逊经营边界探索",
      "route": "/amazon-boundary",
      "source_path": "亚马逊政策边界/",
      "enabled": true,
      "icon": "◎",
      "kind": "boundary",
      "nav_group": "intelligence",
      "readiness": "LIVE_READ",
      "summary": "APR、AOM 与 APB 的证据化入口。"
    },
    {
      "id": "apr",
      "label": "APR 市场玩法探索",
      "route": "/amazon-boundary/apr",
      "parent": "amazon-boundary",
      "source_path": "亚马逊政策边界/",
      "view_contract": "UI界面设计板块/亚马逊政策边界中心/APRExplorationView.schema.json",
      "priority": "PRIMARY",
      "kind": "boundary",
      "readiness": "LIVE_READ",
      "summary": "市场现象与边界信号。"
    },
    {
      "id": "aom",
      "label": "AOM 正向运营方法",
      "route": "/amazon-boundary/aom",
      "parent": "amazon-boundary",
      "source_path": "亚马逊政策边界/",
      "view_contract": "UI界面设计板块/亚马逊政策边界中心/PositiveOperatingMethodView.schema.json",
      "priority": "PRIMARY",
      "kind": "boundary",
      "readiness": "LIVE_READ",
      "summary": "合规运营方法库。"
    },
    {
      "id": "apb",
      "label": "APB 政策与边界证据",
      "route": "/amazon-boundary/apb",
      "parent": "amazon-boundary",
      "source_path": "亚马逊政策边界/",
      "view_contract": "UI界面设计板块/亚马逊政策边界中心/AmazonPolicyBoundaryView.schema.json",
      "priority": "SECONDARY",
      "kind": "boundary",
      "readiness": "LIVE_READ",
      "summary": "政策证据和边界结论。"
    },
    {
      "id": "agents",
      "label": "Agent",
      "route": "/agents",
      "source_path": "Agent板块/",
      "enabled": true,
      "icon": "✦",
      "kind": "module",
      "nav_group": "automation",
      "readiness": "PARTIAL_LIVE",
      "summary": "运营总控与专业 Agent 的状态、输入与受控工作流。",
      "connectors": [
        "codex"
      ]
    },
    {
      "id": "skills",
      "label": "技能",
      "route": "/skills",
      "source_path": "技能板块/",
      "enabled": true,
      "icon": "⌁",
      "kind": "module",
      "nav_group": "system",
      "readiness": "CONTRACT_READY",
      "summary": "可复用能力、工具契约和权限边界。"
    },
    {
      "id": "connectors",
      "label": "对外连接",
      "route": "/connectors",
      "source_path": "对外连接板块/",
      "enabled": true,
      "icon": "⇄",
      "kind": "connectors",
      "nav_group": "system",
      "readiness": "PARTIAL_LIVE",
      "summary": "Amazon、SIF、Cloudflare、Email、Codex 的统一健康状态。"
    },
    {
      "id": "amazon-sp-api-console",
      "label": "Amazon SP-API",
      "route": "/connectors/amazon-sp-api",
      "parent": "connectors",
      "source_path": "对外连接板块/",
      "kind": "connector",
      "readiness": "LIVE_READ",
      "summary": "Amazon SP-API 的只读健康状态与安全接入边界。",
      "connectors": [
        "amazon-sp-api"
      ],
      "legacy_source": "amazon-sp-api.html"
    },
    {
      "id": "amazon-ads-console",
      "label": "Amazon Ads 设置",
      "route": "/connectors/amazon-ads",
      "parent": "connectors",
      "source_path": "对外连接板块/",
      "kind": "connector",
      "readiness": "PARTIAL_LIVE",
      "summary": "Amazon Ads OAuth、Profiles、读取状态与受控 Campaign 写入门禁。",
      "connectors": [
        "amazon-ads"
      ]
    },
    {
      "id": "tasks",
      "label": "任务中心",
      "route": "/tasks",
      "source_path": "任务中心板块/",
      "enabled": true,
      "icon": "☑",
      "kind": "module",
      "nav_group": "automation",
      "readiness": "LIVE_EMPTY",
      "summary": "Decision、Approval、Permission 与 Outcome 的受控链路。"
    },
    {
      "id": "knowledge",
      "label": "知识",
      "route": "/knowledge",
      "source_path": "知识板块/",
      "enabled": true,
      "icon": "◇",
      "kind": "module",
      "nav_group": "intelligence",
      "readiness": "LIVE_READ",
      "summary": "可复用经营知识、规则、方法与经验。"
    },
    {
      "id": "memory",
      "label": "记忆",
      "route": "/memory",
      "source_path": "记忆板块/",
      "enabled": true,
      "icon": "◫",
      "kind": "module",
      "nav_group": "system",
      "readiness": "CONTRACT_READY",
      "summary": "产品、任务、决策、结果与经营历史。"
    },
    {
      "id": "data",
      "label": "数据",
      "route": "/data",
      "source_path": "数据板块/",
      "enabled": true,
      "icon": "▤",
      "kind": "module",
      "nav_group": "system",
      "readiness": "LIVE_READ",
      "summary": "HOT、WARM、COLD 事实层、数据质量与来源追溯。"
    },
    {
      "id": "ui-design",
      "label": "UI设计与契约",
      "route": "/system/ui-design",
      "source_path": "UI界面设计板块/",
      "kind": "support",
      "nav_group": "support",
      "readiness": "CONTRACT_READY",
      "summary": "导航、路由、读模型与页面契约。"
    },
    {
      "id": "conflicts",
      "label": "系统冲突问题库",
      "route": "/system/conflicts",
      "source_path": "系统冲突问题库/",
      "kind": "support",
      "nav_group": "support",
      "readiness": "TRACKED",
      "summary": "跨模块问题登记、修复与验证闭环。"
    },
    {
      "id": "system-overview",
      "label": "系统地图",
      "route": "/system/overview",
      "navigation_visible": false,
      "kind": "support",
      "nav_group": "support",
      "readiness": "LIVE_READ",
      "summary": "GitHub 架构盘点与 Cloudflare 资源概览。"
    }
  ],
  "connectors": [
    {
      "connector_id": "cloudflare",
      "label": "Cloudflare",
      "route": "/connectors",
      "endpoint": "https://1122-cloudflare-bridge.zhangshuaibing01.workers.dev/cloudflare-status",
      "healthPath": "cloudflare",
      "timeoutMs": 5000,
      "retries": 1,
      "writeMode": "approval-only"
    },
    {
      "connector_id": "amazon-sp-api",
      "label": "Amazon SP-API",
      "route": "/connectors/amazon-sp-api",
      "endpoint": "https://1122-amazon-sp-api-bridge.zhangshuaibing01.workers.dev/connection-status",
      "healthPath": "connection-status",
      "timeoutMs": 6000,
      "retries": 1,
      "writeMode": "worker-only"
    },
    {
      "connector_id": "amazon-ads",
      "label": "Amazon Ads",
      "route": "/connectors/amazon-ads",
      "endpoint": "https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev/connection-status",
      "healthPath": "connection-status",
      "timeoutMs": 6000,
      "retries": 1,
      "writeMode": "approval-required"
    },
    {
      "connector_id": "sif",
      "label": "SIF MCP",
      "route": "/connectors",
      "endpoint": "https://sif-api.sorilo-uk.com/connection-status",
      "healthPath": "connection-status",
      "timeoutMs": 6000,
      "retries": 1,
      "writeMode": "protected-research"
    },
    {
      "connector_id": "email",
      "label": "Email Bridge",
      "route": "/connectors",
      "endpoint": "https://1122-email-bridge.zhangshuaibing01.workers.dev/connection-status",
      "healthPath": "connection-status",
      "timeoutMs": 5000,
      "retries": 0,
      "writeMode": "worker-only"
    },
    {
      "connector_id": "codex",
      "label": "Codex / GitHub Task Bridge",
      "route": "/connectors",
      "endpoint": null,
      "healthPath": "local-gateway",
      "timeoutMs": 0,
      "retries": 0,
      "writeMode": "human-or-gateway"
    }
  ],
  "routes": [
    {
      "route": "/command-center",
      "type": "static",
      "id": "command-center"
    },
    {
      "route": "/selection",
      "type": "static",
      "id": "selection"
    },
    {
      "route": "/operations",
      "type": "static",
      "id": "operations"
    },
    {
      "route": "/operations/products",
      "type": "static",
      "id": "products"
    },
    {
      "route": "/operations/inventory-logistics",
      "type": "static",
      "id": "inventory-logistics"
    },
    {
      "route": "/operations/offsite",
      "type": "static",
      "id": "offsite"
    },
    {
      "route": "/operations/competitors",
      "type": "static",
      "id": "competitors"
    },
    {
      "route": "/operations/competitors/keywords",
      "type": "static",
      "id": "competitor-keywords",
      "view_contract": "UI界面设计板块/竞品关键词工作台/CompetitorKeywordWorkbenchView.schema.json"
    },
    {
      "route": "/operations/ads",
      "type": "static",
      "id": "ads"
    },
    {
      "route": "/sandbox",
      "type": "static",
      "id": "sandbox"
    },
    {
      "route": "/governance",
      "type": "static",
      "id": "internal-policy"
    },
    {
      "route": "/amazon-boundary",
      "type": "static",
      "id": "amazon-boundary"
    },
    {
      "route": "/amazon-boundary/apr",
      "type": "static",
      "id": "apr",
      "view_contract": "UI界面设计板块/亚马逊政策边界中心/APRExplorationView.schema.json"
    },
    {
      "route": "/amazon-boundary/aom",
      "type": "static",
      "id": "aom",
      "view_contract": "UI界面设计板块/亚马逊政策边界中心/PositiveOperatingMethodView.schema.json"
    },
    {
      "route": "/amazon-boundary/apb",
      "type": "static",
      "id": "apb",
      "view_contract": "UI界面设计板块/亚马逊政策边界中心/AmazonPolicyBoundaryView.schema.json"
    },
    {
      "route": "/agents",
      "type": "static",
      "id": "agents"
    },
    {
      "route": "/skills",
      "type": "static",
      "id": "skills"
    },
    {
      "route": "/connectors",
      "type": "static",
      "id": "connectors"
    },
    {
      "route": "/connectors/amazon-sp-api",
      "type": "static",
      "id": "amazon-sp-api-console"
    },
    {
      "route": "/connectors/amazon-ads",
      "type": "static",
      "id": "amazon-ads-console"
    },
    {
      "route": "/tasks",
      "type": "static",
      "id": "tasks"
    },
    {
      "route": "/knowledge",
      "type": "static",
      "id": "knowledge"
    },
    {
      "route": "/memory",
      "type": "static",
      "id": "memory"
    },
    {
      "route": "/data",
      "type": "static",
      "id": "data"
    },
    {
      "route": "/system/ui-design",
      "type": "static",
      "id": "ui-design"
    },
    {
      "route": "/system/conflicts",
      "type": "static",
      "id": "conflicts"
    },
    {
      "route": "/system/overview",
      "type": "static",
      "id": "system-overview"
    },
    {
      "route": "/products/:product_id",
      "type": "product-template",
      "label": "产品状态卡",
      "view_contract": "UI界面设计板块/产品状态卡/ProductStateAggregatorV0/ProductStatusCardView.schema.json"
    },
    {
      "route": "/products/:product_id/policy-impact",
      "type": "product-template",
      "label": "Amazon政策与APR影响",
      "view_contract": "UI界面设计板块/产品状态卡/ProductStateAggregatorV0/ProductPolicyImpactView.schema.json"
    },
    {
      "route": "/",
      "type": "alias",
      "target": "/command-center"
    }
  ],
  "navigation": [
    {
      "id": "command-center",
      "label": "经营指挥中心",
      "icon": "◈",
      "route": "#/command-center"
    },
    {
      "id": "selection",
      "label": "选品",
      "icon": "◉",
      "route": "#/selection"
    },
    {
      "id": "operations",
      "label": "运营",
      "icon": "▦",
      "route": "#/operations",
      "children": [
        {
          "id": "products",
          "label": "产品",
          "route": "#/operations/products"
        },
        {
          "id": "inventory-logistics",
          "label": "库存物流",
          "route": "#/operations/inventory-logistics"
        },
        {
          "id": "offsite",
          "label": "站外推广",
          "route": "#/operations/offsite"
        },
        {
          "id": "competitors",
          "label": "竞品",
          "route": "#/operations/competitors",
          "children": [
            {
              "id": "competitor-keywords",
              "label": "竞品关键词工作台",
              "route": "#/operations/competitors/keywords"
            }
          ]
        },
        {
          "id": "ads",
          "label": "广告",
          "route": "#/operations/ads"
        }
      ]
    },
    {
      "id": "sandbox",
      "label": "沙盘演练",
      "icon": "◇",
      "route": "#/sandbox"
    },
    {
      "id": "internal-policy",
      "label": "系统政策边界",
      "icon": "⌘",
      "route": "#/governance"
    },
    {
      "id": "amazon-boundary",
      "label": "亚马逊经营边界探索",
      "icon": "◎",
      "route": "#/amazon-boundary",
      "children": [
        {
          "id": "apr",
          "label": "APR 市场玩法探索",
          "route": "#/amazon-boundary/apr"
        },
        {
          "id": "aom",
          "label": "AOM 正向运营方法",
          "route": "#/amazon-boundary/aom"
        },
        {
          "id": "apb",
          "label": "APB 政策与边界证据",
          "route": "#/amazon-boundary/apb"
        }
      ]
    },
    {
      "id": "agents",
      "label": "Agent",
      "icon": "✦",
      "route": "#/agents"
    },
    {
      "id": "skills",
      "label": "技能",
      "icon": "⌁",
      "route": "#/skills"
    },
    {
      "id": "connectors",
      "label": "对外连接",
      "icon": "⇄",
      "route": "#/connectors",
      "children": [
        {
          "id": "amazon-sp-api-console",
          "label": "Amazon SP-API",
          "route": "#/connectors/amazon-sp-api"
        },
        {
          "id": "amazon-ads-console",
          "label": "Amazon Ads 设置",
          "route": "#/connectors/amazon-ads"
        }
      ]
    },
    {
      "id": "tasks",
      "label": "任务中心",
      "icon": "☑",
      "route": "#/tasks"
    },
    {
      "id": "knowledge",
      "label": "知识",
      "icon": "◇",
      "route": "#/knowledge"
    },
    {
      "id": "memory",
      "label": "记忆",
      "icon": "◫",
      "route": "#/memory"
    },
    {
      "id": "data",
      "label": "数据",
      "icon": "▤",
      "route": "#/data"
    }
  ],
  "global_shortcuts": [
    {
      "id": "needs-me",
      "name_cn": "今日需要我处理",
      "route": "/command-center#human-tasks"
    },
    {
      "id": "agent-activity",
      "name_cn": "Agent今日动态",
      "route": "/command-center#agent-activity"
    },
    {
      "id": "apr-latest",
      "name_cn": "最新APR探索",
      "route": "/amazon-boundary/apr"
    },
    {
      "id": "aom-recommended",
      "name_cn": "推荐运营方法",
      "route": "/amazon-boundary/aom"
    },
    {
      "id": "policy-changes",
      "name_cn": "Amazon政策变化",
      "route": "/amazon-boundary/apb"
    }
  ],
  "authorization": {
    "execution_authorized": false,
    "production_write_authorized": false,
    "amazon_write_authorized": false,
    "research_execution_mode": "protected-key"
  }
};
  window.__1122_REGISTRY__ = deepFreeze(registry);
})();
