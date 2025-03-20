# 动漫资源搜索与下载系统

这是一个基于 Node.js 的动漫资源搜索和下载系统，可以从蜜柑计划网站爬取动漫资源，并通过 qBittorrent 进行下载。

## 功能特点

- 从蜜柑计划网站爬取动漫资源信息
- 提供动漫搜索和浏览功能
- 支持查看动漫详情和剧集列表
- 集成 qBittorrent 进行下载
- 使用 MySQL 数据库存储数据

## 技术栈

- 前端：HTML、CSS、JavaScript、Bootstrap
- 后端：Node.js、Express
- 数据库：MySQL
- 下载工具：qBittorrent

## 安装步骤

1. 克隆项目到本地
2. 安装依赖：
   ```bash
   npm install
   ```
3. 配置环境变量：
   - 复制 `.env.example` 文件为 `.env`
   - 修改数据库和 qBittorrent 的连接信息

4. 初始化数据库：
   ```bash
   mysql -u admin -p < init.sql
   ```

5. 运行爬虫脚本：
   ```bash
   node scraper.js
   ```

6. 启动服务器：
   ```bash
   npm start
   ```

## 使用说明

1. 访问 `http://localhost:3000` 打开网页
2. 使用搜索框搜索动漫
3. 点击动漫卡片查看详情
4. 在详情页面可以查看剧集列表并下载

## 注意事项

- 确保 MySQL 数据库已启动并可访问
- 确保 qBittorrent 已正确配置并可访问
- 爬虫脚本需要根据蜜柑计划网站的实际结构进行调整 