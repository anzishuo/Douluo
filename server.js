import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { QBittorrent } from '@ctrl/qbittorrent';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// 初始化环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 数据库连接配置
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME // 直接使用已存在的数据库
};

// 初始化数据库表
async function initDatabase() {
    try {
        console.log('正在连接数据库...');
        
        // 直接连接到指定数据库
        const pool = mysql.createPool(dbConfig);
        
        // 从文件读取初始化SQL脚本
        const initSql = fs.readFileSync('./init.sql', 'utf8');
        
        // 执行SQL脚本，按分号分隔语句
        const statements = initSql.split(';').filter(stmt => stmt.trim());
        for (const stmt of statements) {
            if (stmt.trim()) {
                try {
                    await pool.query(stmt);
                } catch (err) {
                    console.error(`执行SQL语句失败: ${stmt}`);
                    console.error(err);
                    // 继续执行其他语句
                }
            }
        }
        
        console.log('数据表初始化完成');
        
        return pool;
    } catch (error) {
        console.error('数据库初始化失败:', error);
        throw error;
    }
}

// 插入测试数据
async function insertTestData(pool) {
    try {
        console.log('正在插入测试数据...');
        
        // 检查是否已有数据
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM anime');
        
        if (rows[0].count === 0) {
            // 插入测试动漫数据
            const [animeResult] = await pool.query(
                'INSERT INTO anime (title, original_title, description, cover_url) VALUES (?, ?, ?, ?)',
                ['测试动漫1', 'Test Anime 1', '这是一个测试动漫', 'https://via.placeholder.com/300x450']
            );
            
            const animeId = animeResult.insertId;
            
            // 插入测试剧集数据
            await pool.query(
                'INSERT INTO episodes (anime_id, episode_number, title, magnet_url, size) VALUES (?, ?, ?, ?, ?)',
                [animeId, '第01集', '测试剧集1', 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678', '500MB']
            );
            
            await pool.query(
                'INSERT INTO episodes (anime_id, episode_number, title, magnet_url, size) VALUES (?, ?, ?, ?, ?)',
                [animeId, '第02集', '测试剧集2', 'magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12', '510MB']
            );
            
            // 再添加一个动漫示例
            const [animeResult2] = await pool.query(
                'INSERT INTO anime (title, original_title, description, cover_url) VALUES (?, ?, ?, ?)',
                ['进击的巨人', 'Attack on Titan', '人类与巨人的战斗故事', 'https://via.placeholder.com/300x450']
            );
            
            const animeId2 = animeResult2.insertId;
            
            await pool.query(
                'INSERT INTO episodes (anime_id, episode_number, title, magnet_url, size) VALUES (?, ?, ?, ?, ?)',
                [animeId2, '第01集', '进击的巨人 第一集', 'magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12', '720MB']
            );
            
            console.log('测试数据插入完成');
        } else {
            console.log('数据库中已有数据，跳过测试数据插入');
        }
    } catch (error) {
        console.error('插入测试数据失败:', error);
    }
}

let pool; // 全局连接池

// 初始化 qBittorrent 客户端
const qbClient = new QBittorrent({
    baseUrl: process.env.QB_URL, 
    username: process.env.QB_USERNAME,
    password: process.env.QB_PASSWORD
});

// 路由：主页面
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

// 路由：获取动漫列表（包含搜索功能）
app.get('/api/anime', async (req, res) => {
    try {
        if (!pool) {
            console.error('数据库连接未初始化');
            return res.status(500).json({ error: '数据库连接未初始化' });
        }
        
        const searchTerm = req.query.search;
        let query = 'SELECT * FROM anime';
        let params = [];
        
        if (searchTerm) {
            // 添加搜索条件，匹配标题或原标题
            query += ' WHERE title LIKE ? OR original_title LIKE ?';
            params = [`%${searchTerm}%`, `%${searchTerm}%`];
            console.log(`搜索动漫: ${searchTerm}`);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [rows] = await pool.query(query, params);
        console.log(`找到 ${rows.length} 个结果`);
        res.json(rows);
    } catch (error) {
        console.error('获取动漫列表失败:', error);
        res.status(500).json({ error: '获取动漫列表失败' });
    }
});

// 路由：获取动漫详情
app.get('/api/anime/:id', async (req, res) => {
    try {
        const [anime] = await pool.query('SELECT * FROM anime WHERE id = ?', [req.params.id]);
        if (anime.length === 0) {
            return res.status(404).json({ error: 'Anime not found' });
        }
        const [episodes] = await pool.query('SELECT * FROM episodes WHERE anime_id = ?', [req.params.id]);
        res.json({ ...anime[0], episodes });
    } catch (error) {
        console.error('Error fetching anime details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 路由：开始下载
app.post('/api/download/:episodeId', async (req, res) => {
    try {
        const [episode] = await pool.query('SELECT * FROM episodes WHERE id = ?', [req.params.episodeId]);
        if (episode.length === 0) {
            return res.status(404).json({ error: 'Episode not found' });
        }

        // 创建下载记录
        await pool.query(
            'INSERT INTO download_history (episode_id, status) VALUES (?, ?)',
            [req.params.episodeId, 'pending']
        );

        // 添加到 qBittorrent
        await qbClient.addMagnet(episode[0].magnet_url);

        res.json({ message: 'Download started' });
    } catch (error) {
        console.error('Error starting download:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 路由：手动插入测试数据
app.get('/api/init-test-data', async (req, res) => {
    try {
        await insertTestData(pool);
        res.json({ message: '测试数据初始化成功' });
    } catch (error) {
        console.error('测试数据初始化失败:', error);
        res.status(500).json({ error: '测试数据初始化失败' });
    }
});

// 路由：从蜜柑计划获取动漫信息
app.get('/api/mikan/search', async (req, res) => {
    try {
        const searchTerm = req.query.keyword;
        if (!searchTerm) {
            return res.status(400).json({ error: '请提供搜索关键词' });
        }

        const response = await axios.get(`https://mikanani.kas.pub/api/v2/Search/SearchAnime?keyword=${encodeURIComponent(searchTerm)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // 处理蜜柑计划的响应数据
        const animeList = response.data.data.map(item => ({
            id: item.id,
            title: item.name,
            original_title: item.name_cn || item.name,
            description: item.description || '',
            cover_url: item.cover_url || '',
            episodes: item.episodes || []
        }));

        res.json(animeList);
    } catch (error) {
        console.error('从蜜柑计划获取数据失败:', error);
        res.status(500).json({ error: '获取动漫信息失败' });
    }
});

// 路由：从蜜柑计划获取动漫详情
app.get('/api/mikan/anime/:id', async (req, res) => {
    try {
        const response = await axios.get(`https://mikanani.kas.pub/api/v2/Anime/AnimeInfo?animeId=${req.params.id}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const animeInfo = response.data.data;
        res.json({
            id: animeInfo.id,
            title: animeInfo.name,
            original_title: animeInfo.name_cn || animeInfo.name,
            description: animeInfo.description || '',
            cover_url: animeInfo.cover_url || '',
            episodes: animeInfo.episodes || []
        });
    } catch (error) {
        console.error('从蜜柑计划获取动漫详情失败:', error);
        res.status(500).json({ error: '获取动漫详情失败' });
    }
});

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库连接池
        pool = await initDatabase();
        
        // 插入测试数据
        await insertTestData(pool);
        
        app.listen(port, () => {
            console.log(`服务器已启动，访问 http://localhost:${port}`);
        });
    } catch (error) {
        console.error('服务器启动失败:', error);
    }
}

startServer(); 