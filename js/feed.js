// feed.js - компонент ленты видео

(function() {
    'use strict';

    window.FeedComponent = class FeedComponent extends window.BaseComponent {
        constructor() {
            super('Feed');
            this.videos = [];
            this.currentVideoIndex = 0;
            this.observer = null;
            this.videoObserver = null;
            this.isLoading = false;
            this.hasMore = true;
            this.lastVideoId = null;
            this.likedVideos = new Map(); // Кэш лайков
            this.savedVideos = new Map(); // Кэш сохранений
        }

        // ========== ЗАГРУЗКА ДАННЫХ ==========

        async load(params = {}) {
            await super.load(params);
            
            const container = document.getElementById('feedContainer');
            if (!container) return;

            // Показываем скелетон загрузки
            this.showSkeleton(container);

            try {
                // Загружаем видео
                await this.loadVideos();
                
                // Рендерим ленту
                this.render(container);
                
                // Настраиваем observers
                this.setupObservers(container);
                
                // Загружаем состояния лайков/сохранений если авторизован
                if (window.auth.isAuthenticated) {
                    await this.loadUserInteractions();
                }

            } catch (error) {
                console.error('[Feed] Failed to load:', error);
                this.showError(container, 'Не удалось загрузить видео');
            }
        }

        async loadVideos(loadMore = false) {
            if (this.isLoading || (!loadMore && this.videos.length > 0)) return;

            this.isLoading = true;

            try {
                let newVideos;
                
                if (window.auth.isAuthenticated) {
                    // Для авторизованных - лента из подписок
                    newVideos = await window.auth.getFeed(5);
                } else {
                    // Для гостей - популярные видео
                    newVideos = await window.flumDb.getVideos(5, this.lastVideoId);
                }

                if (newVideos.length === 0) {
                    this.hasMore = false;
                } else {
                    if (loadMore) {
                        this.videos = [...this.videos, ...newVideos];
                    } else {
                        this.videos = newVideos;
                    }
                    this.lastVideoId = newVideos[newVideos.length - 1]?.id;
                }

            } catch (error) {
                console.error('[Feed] Failed to load videos:', error);
                throw error;
            } finally {
                this.isLoading = false;
            }
        }

        async loadUserInteractions() {
            const userId = window.auth.getUserId();
            
            // Загружаем лайки
            const likedIds = await window.flumDb.getUserLikes(userId);
            likedIds.forEach(id => this.likedVideos.set(id, true));

            // Загружаем сохранения
            const savedIds = await window.flumDb.getUserSaves(userId);
            savedIds.forEach(id => this.savedVideos.set(id, true));
        }

        // ========== РЕНДЕРИНГ ==========

        render(container) {
            window.utils.emptyElement(container);

            if (this.videos.length === 0) {
                this.showEmptyState(container);
                return;
            }

            // Рендерим каждое видео
            this.videos.forEach((video, index) => {
                const card = this.createVideoCard(video, index);
                container.appendChild(card);
            });

            // Добавляем спиннер для подгрузки
            this.addLoadingSpinner(container);
        }

        createVideoCard(video, index) {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.dataset.videoId = video.id;
            card.dataset.index = index;

            const isLiked = this.likedVideos.has(video.id);
            const isSaved = this.savedVideos.has(video.id);

            // Получаем данные пользователя
            window.flumDb.getUserById(video.userId).then(user => {
                if (user) {
                    this.updateUserInfo(card, user);
                }
            });

            card.innerHTML = `
                <video class="bg-video" src="${video.url}" loop playsinline></video>
                <div class="heart-overlay"><i class="fa-solid fa-heart"></i></div>
                
                <div class="video-info">
                    <div class="user-row" data-userid="${video.userId}">
                        <img class="avatar" src="https://i.pravatar.cc/150?u=${video.userId}" loading="lazy" data-userid="${video.userId}">
                        <span class="username" data-userid="${video.userId}">@user_${video.userId.substring(0, 5)}</span>
                        <i class="fa-solid fa-circle-check verified" style="display: none;"></i>
                    </div>
                    <div class="caption">${window.utils.truncateText(video.caption || '', 100)}</div>
                    <div class="music-row">
                        <div class="music-icon"><i class="fa-solid fa-music"></i></div>
                        <span>${video.music || 'оригинальный звук'}</span>
                    </div>
                </div>

                <div class="action-bar">
                    <div class="action-item like-item">
                        <i class="fa-regular fa-heart ${isLiked ? 'liked' : ''}" data-action="like"></i>
                        <span class="count like-count">${window.utils.formatCount(video.likes || 0)}</span>
                    </div>
                    <div class="action-item comment-item">
                        <i class="fa-regular fa-comment" data-action="comment"></i>
                        <span class="count comment-count">${window.utils.formatCount(video.comments || 0)}</span>
                    </div>
                    <div class="action-item save-item">
                        <i class="fa-regular fa-bookmark ${isSaved ? 'saved' : ''}" data-action="save"></i>
                        <span class="count save-count">${window.utils.formatCount(video.saves || 0)}</span>
                    </div>
                    <div class="action-item share-item">
                        <i class="fa-solid fa-share" data-action="share"></i>
                        <span class="count">${window.utils.formatCount(Math.floor(Math.random() * 100))}</span>
                    </div>
                </div>
            `;

            // Добавляем обработчики событий
            this.attachEventHandlers(card, video);

            return card;
        }

        async updateUserInfo(card, user) {
            const avatar = card.querySelector('.avatar');
            const username = card.querySelector('.username');
            const verified = card.querySelector('.verified');

            if (avatar) avatar.src = user.avatar;
            if (username) username.textContent = `@${user.username}`;
            if (verified) verified.style.display = user.verified ? 'inline-block' : 'none';
        }

        attachEventHandlers(card, video) {
            const videoEl = card.querySelector('.bg-video');
            const heartOverlay = card.querySelector('.heart-overlay');
            const likeIcon = card.querySelector('[data-action="like"]');
            const likeCount = card.querySelector('.like-count');
            const saveIcon = card.querySelector('[data-action="save"]');
            const saveCount = card.querySelector('.save-count');
            const commentIcon = card.querySelector('[data-action="comment"]');
            const shareIcon = card.querySelector('[data-action="share"]');
            const userRow = card.querySelector('.user-row');

            // Звук всегда включен
            videoEl.volume = 1.0;
            videoEl.muted = false;

            // Клик по видео - пауза/плей
            videoEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (videoEl.paused) {
                    videoEl.play();
                } else {
                    videoEl.pause();
                }
            });

            // Двойной клик - лайк
            videoEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.handleLike(video, likeIcon, likeCount, heartOverlay);
            });

            // Лайк по кнопке
            likeIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleLike(video, likeIcon, likeCount, null);
            });

            // Сохранение
            saveIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleSave(video, saveIcon, saveCount);
            });

            // Комментарии
            commentIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openComments(video.id);
            });

            // Шеринг
            shareIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openShare(video);
            });

            // Переход в профиль
            userRow.addEventListener('click', (e) => {
                e.stopPropagation();
                window.app.loadPage('profile', { userId: video.userId });
            });
        }

        // ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ==========

        async handleLike(video, icon, countEl, overlay = null) {
            if (!window.auth.isAuthenticated) {
                const user = await window.auth.showAuthModal();
                if (!user) return;
            }

            try {
                const isLiked = await window.auth.likeVideo(video.id);
                
                // Обновляем UI
                icon.classList.toggle('fa-regular', !isLiked);
                icon.classList.toggle('fa-solid', isLiked);
                icon.classList.toggle('liked', isLiked);

                // Обновляем счетчик
                video.likes += isLiked ? 1 : -1;
                countEl.textContent = window.utils.formatCount(video.likes);

                // Анимация сердечка
                if (overlay && isLiked) {
                    overlay.classList.remove('show');
                    void overlay.offsetWidth;
                    overlay.classList.add('show');
                    setTimeout(() => overlay.classList.remove('show'), 500);
                }

                // Обновляем кэш
                if (isLiked) {
                    this.likedVideos.set(video.id, true);
                } else {
                    this.likedVideos.delete(video.id);
                }

            } catch (error) {
                console.error('[Feed] Like failed:', error);
                window.app.showError('Не удалось поставить лайк');
            }
        }

        async handleSave(video, icon, countEl) {
            if (!window.auth.isAuthenticated) {
                const user = await window.auth.showAuthModal();
                if (!user) return;
            }

            try {
                const isSaved = await window.auth.saveVideo(video.id);
                
                // Обновляем UI
                icon.classList.toggle('fa-regular', !isSaved);
                icon.classList.toggle('fa-solid', isSaved);
                icon.classList.toggle('saved', isSaved);

                // Обновляем счетчик
                video.saves += isSaved ? 1 : -1;
                countEl.textContent = window.utils.formatCount(video.saves);

                // Обновляем кэш
                if (isSaved) {
                    this.savedVideos.set(video.id, true);
                } else {
                    this.savedVideos.delete(video.id);
                }

            } catch (error) {
                console.error('[Feed] Save failed:', error);
                window.app.showError('Не удалось сохранить видео');
            }
        }

        openComments(videoId) {
            window.comments.openForVideo(videoId);
        }

        openShare(video) {
            // Создаем модалку шеринга
            const modal = document.createElement('div');
            modal.className = 'modal share-modal show';
            
            modal.innerHTML = `
                <div class="modal-sheet">
                    <div class="modal-header">
                        <div class="modal-title">Поделиться видео</div>
                        <span class="modal-close">&times;</span>
                    </div>
                    <div class="share-options">
                        <div class="share-option" data-platform="telegram">
                            <div class="share-icon"><i class="fab fa-telegram"></i></div>
                            <span class="share-label">Telegram</span>
                        </div>
                        <div class="share-option" data-platform="whatsapp">
                            <div class="share-icon"><i class="fab fa-whatsapp"></i></div>
                            <span class="share-label">WhatsApp</span>
                        </div>
                        <div class="share-option" data-platform="vkontakte">
                            <div class="share-icon"><i class="fab fa-vk"></i></div>
                            <span class="share-label">VK</span>
                        </div>
                        <div class="share-option" data-platform="copy">
                            <div class="share-icon"><i class="fas fa-link"></i></div>
                            <span class="share-label">Копировать</span>
                        </div>
                    </div>
                    <div class="share-link">
                        <input type="text" value="${video.url}" readonly>
                        <button class="share-copy">Копировать</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Обработчики
            const closeBtn = modal.querySelector('.modal-close');
            closeBtn.addEventListener('click', () => modal.remove());

            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            const copyBtn = modal.querySelector('.share-copy');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(video.url);
                copyBtn.textContent = 'Скопировано!';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.textContent = 'Копировать';
                    copyBtn.classList.remove('copied');
                }, 2000);
            });
        }

        // ========== НАБЛЮДАТЕЛИ ==========

        setupObservers(container) {
            // Observer для автоплея
            this.videoObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const video = entry.target.querySelector('.bg-video');
                    if (!video) return;

                    if (entry.isIntersecting) {
                        video.play().catch(e => console.log('[Feed] Play error:', e));
                        video.volume = 1.0;
                        video.muted = false;
                    } else {
                        video.pause();
                    }
                });
            }, { root: container, threshold: 0.7 });

            document.querySelectorAll('.video-card').forEach(card => {
                this.videoObserver.observe(card);
            });

            // Observer для бесконечной ленты
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && this.hasMore && !this.isLoading) {
                        this.loadMoreVideos();
                    }
                });
            }, { root: container, threshold: 0.1 });

            const spinner = document.getElementById('feedSpinner');
            if (spinner) {
                this.observer.observe(spinner);
            }
        }

        async loadMoreVideos() {
            try {
                await this.loadVideos(true);
                
                const container = document.getElementById('feedContainer');
                const spinner = document.getElementById('feedSpinner');
                
                // Удаляем старые карточки и спиннер
                if (spinner) spinner.remove();
                
                // Рендерим новые видео
                this.videos.slice(-5).forEach(video => {
                    const card = this.createVideoCard(video, this.videos.length - 1);
                    container.insertBefore(card, container.lastElementChild);
                });
                
                // Добавляем новый спиннер
                this.addLoadingSpinner(container);
                
                // Обновляем observers
                if (this.videoObserver) {
                    document.querySelectorAll('.video-card').forEach(card => {
                        this.videoObserver.observe(card);
                    });
                }

            } catch (error) {
                console.error('[Feed] Failed to load more:', error);
            }
        }

        // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

        showSkeleton(container) {
            container.innerHTML = '';
            for (let i = 0; i < 3; i++) {
                const skeleton = document.createElement('div');
                skeleton.className = 'video-card skeleton';
                container.appendChild(skeleton);
            }
        }

        showEmptyState(container) {
            container.innerHTML = `
                <div class="profile-empty">
                    <i class="fa-regular fa-film"></i>
                    <h3>Здесь пока нет видео</h3>
                    <p>Подпишитесь на авторов, чтобы видеть их новые видео</p>
                    <button class="profile-empty-btn" onclick="window.app.loadPage('discover')">
                        Найти интересных авторов
                    </button>
                </div>
            `;
        }

        addLoadingSpinner(container) {
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.id = 'feedSpinner';
            spinner.innerHTML = `
                <div class="spinner"></div>
                <span>Загружаем ещё видео...</span>
            `;
            container.appendChild(spinner);
        }

        showError(container, message) {
            container.innerHTML = `
                <div class="profile-empty">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>${message}</p>
                    <button class="profile-empty-btn" onclick="window.feed.load()">
                        Попробовать снова
                    </button>
                </div>
            `;
        }

        // ========== ОЧИСТКА ==========

        unload() {
            if (this.videoObserver) {
                this.videoObserver.disconnect();
                this.videoObserver = null;
            }
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            super.unload();
        }
    };

    // Создаем глобальный экземпляр
    window.feed = new FeedComponent();

    console.log('[Feed] Component loaded');
})();
