document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const animeList = document.getElementById('animeList');
    
    // 初始化 Bootstrap 模态框
    let animeModal;
    if (document.getElementById('animeModal')) {
        animeModal = new bootstrap.Modal(document.getElementById('animeModal'));
    }

    // 加载动漫列表
    async function loadAnimeList(searchTerm = '') {
        try {
            let url = '/api/anime';
            if (searchTerm) {
                url += `?search=${encodeURIComponent(searchTerm)}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP 错误! 状态: ${response.status}`);
            }
            
            const anime = await response.json();
            
            if (anime.length === 0) {
                animeList.innerHTML = '<div class="col-12 text-center mt-4"><h3>没有找到相关动漫</h3></div>';
                return;
            }
            
            displayAnimeList(anime);
        } catch (error) {
            console.error('Error loading anime list:', error);
            showError('加载动漫列表失败');
        }
    }

    // 显示动漫列表
    function displayAnimeList(anime) {
        animeList.innerHTML = anime.map(item => `
            <div class="col-md-4 mb-4">
                <div class="card anime-card">
                    <img src="${item.cover_url}" class="card-img-top anime-cover" alt="${item.title}">
                    <div class="card-body">
                        <h5 class="card-title">${item.title}</h5>
                        <p class="card-text">${item.original_title || ''}</p>
                        <button class="btn btn-primary" onclick="showAnimeDetails(${item.id})">
                            查看详情
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 显示动漫详情
    window.showAnimeDetails = async (animeId) => {
        try {
            const response = await fetch(`/api/anime/${animeId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP 错误! 状态: ${response.status}`);
            }
            
            const anime = await response.json();
            displayAnimeDetails(anime);
            
            if (animeModal) {
                animeModal.show();
            }
        } catch (error) {
            console.error('Error loading anime details:', error);
            showError('加载动漫详情失败');
        }
    };

    // 显示动漫详情内容
    function displayAnimeDetails(anime) {
        const detailsContainer = document.getElementById('animeDetails');
        if (!detailsContainer) return;
        
        detailsContainer.innerHTML = `
            <div class="row">
                <div class="col-md-4">
                    <img src="${anime.cover_url}" class="img-fluid" alt="${anime.title}">
                </div>
                <div class="col-md-8">
                    <h3>${anime.title}</h3>
                    <p>${anime.original_title || ''}</p>
                    <p>${anime.description || '暂无描述'}</p>
                </div>
            </div>
            <div class="mt-4">
                <h4>剧集列表</h4>
                <div class="episode-list">
                    ${anime.episodes && anime.episodes.length > 0 
                      ? anime.episodes.map(episode => `
                        <div class="episode-item">
                            <span>${episode.episode_number}</span>
                            <span>${episode.title}</span>
                            <span>${episode.size}</span>
                            <button class="btn btn-success btn-sm download-btn" 
                                    onclick="startDownload(${episode.id})">
                                下载
                            </button>
                        </div>
                    `).join('')
                      : '<div class="p-3">暂无剧集</div>'
                    }
                </div>
            </div>
        `;
    }

    // 开始下载
    window.startDownload = async (episodeId) => {
        try {
            const response = await fetch(`/api/download/${episodeId}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP 错误! 状态: ${response.status}`);
            }
            
            showSuccess('下载任务已添加到队列');
        } catch (error) {
            console.error('Error starting download:', error);
            showError('开始下载失败');
        }
    };

    // 搜索功能
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const searchTerm = searchInput.value.trim();
            loadAnimeList(searchTerm);
        });
    }
    
    // 回车键搜索
    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const searchTerm = searchInput.value.trim();
                loadAnimeList(searchTerm);
            }
        });
    }

    // 显示错误消息
    function showError(message) {
        alert(message);
    }

    // 显示成功消息
    function showSuccess(message) {
        alert(message);
    }

    // 初始加载
    loadAnimeList();
}); 