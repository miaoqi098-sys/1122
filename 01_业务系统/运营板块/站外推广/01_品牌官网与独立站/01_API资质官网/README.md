# API资质官网 V1

## 归属

`运营板块 → 站外推广 → 品牌官网与独立站`

## 当前目标

建立一个可长期运营、同时满足 Amazon Ads API / SP-API 开发者资质审核基础要求的企业官网。

## 当前页面

- 首页 `site/index.html`
- 公司介绍 `site/about.html`
- 隐私政策 `site/privacy.html`
- 数据使用说明 `site/data-use.html`
- 联系方式 `site/contact.html`

## 上线前必须替换

以下占位符不得带着上线：

- `[公司法定名称]`
- `[COMPANY LEGAL NAME]`
- `[公开联系邮箱]`
- `[公司注册地址或城市]`
- `[正式域名]`

不得在仓库中提交 Amazon Client Secret、Refresh Token、Access Token、密码等敏感信息。

## 部署原则

- 必须使用 HTTPS；
- 页面可公开访问；
- 公司法定名称需与 API 申请主体一致；
- 隐私政策和数据使用说明必须与实际系统数据流一致；
- 当前版本为纯静态站点，可部署至 GitHub Pages、Cloudflare Pages、Vercel 或自有服务器；
- 后续可继续扩展 SEO、内容中心、产品页、博客、落地页和独立站能力。
