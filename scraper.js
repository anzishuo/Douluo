import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import mysql from 'mysql2/promise';

// 初始化环境变量
dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

async function scrapeAnime() {
    const pool = await mysql.createPool(dbConfig);
    try {
        // 根据蜜柑计划的实际网站结构爬取
        const response = await axios.get('https://mikanani.me/');
        const $ = cheerio.load(response.data);
        
        // 爬取首页的动漫列表
        $('.an-box').each(async (i, element) => {
            // 获取动漫标题和链接
            const titleElement = $(element).find('.an-text');
            const title = titleElement.text().trim();
            const animeLink = $(element).find('a').attr('href');
            const animeId = animeLink ? animeLink.split('/').pop() : null;
            
            // 获取封面图片URL
            const coverUrl = $(element).find('img').attr('src');
            
            // 获取更新日期
            const updateDate = $(element).find('.date-text').text().trim();
            
            if (animeId) {
                // 插入动漫信息
                const [result] = await pool.query(
                    'INSERT INTO anime (title, cover_url, update_date) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE cover_url = ?, update_date = ?',
                    [title, coverUrl, updateDate, coverUrl, updateDate]
                );
                
                // 使用数据库生成的ID或现有记录的ID
                const insertedAnimeId = result.insertId || animeId;
                
                // 爬取动漫详情页获取更多信息
                try {
                    const detailResponse = await axios.get(`https://mikanani.me/Home/Bangumi/${animeId}`);
                    const detail$ = cheerio.load(detailResponse.data);
                    
                    // 爬取剧集信息
                    detail$('.episode-list .subgroup-text').each(async (j, episodeElement) => {
                        const episodeTitle = detail$(episodeElement).text().trim();
                        const magnetLink = detail$(episodeElement).closest('tr').find('.magnet-link-wrap a').attr('href');
                        const episodeNumber = detail$(episodeElement).closest('tr').find('.episode-number').text().trim();
                        const fileSize = detail$(episodeElement).closest('tr').find('.file-size').text().trim();
                        
                        if (magnetLink) {
                            // 插入剧集信息
                            await pool.query(
                                'INSERT INTO episodes (anime_id, episode_number, title, magnet_url, size) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE magnet_url = ?, size = ?',
                                [insertedAnimeId, episodeNumber, episodeTitle, magnetLink, fileSize, magnetLink, fileSize]
                            );
                        }
                    });
                } catch (detailError) {
                    console.error(`Error scraping detail for anime ${animeId}:`, detailError);
                }
            }
        });
    } catch (error) {
        console.error('Error scraping anime:', error);
    } finally {
        await pool.end();
    }
}

// 运行爬虫
scrapeAnime(); 