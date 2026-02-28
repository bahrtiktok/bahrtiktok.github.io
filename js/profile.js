// profile.js - компонент профиля пользователя

(function() {
    'use strict';

    window.ProfileComponent = class ProfileComponent extends window.BaseComponent {
        constructor() {
            super('Profile');
            this.currentUserId = null;
            this.profileUser = null;
            this.videos = [];
            this.currentTab = 'videos'; // videos, likes, saved
            this.isFollowing = false;
            this.followersCount = 0;
            this.followingCount = 0;
        }

        // ========== ЗАГРУЗКА ДАННЫХ ==========

        async load(params = {}) {
            await super.load(params);

            const userId = params.userId || window.auth.getUserId();
            if (!userId) {
                window.app.loadPage('feed');
                return;
            }

            this.currentUserId = userId;
            
            try {
                // Показываем скелетон загрузки
                this.showSkeleton();

                // Загружаем данные пользователя
                await this.loadUserData();
                
                // Загружаем видео пользователя
                await this.loadUserVideos();
                
                // Загружаем статус подписки (если авторизован)
                if (window.auth.isAuthenticated) {
                    await this.loadFollowStatus();
                }
                
                // Рендерим профиль
                this.render();
                
                // Настраиваем обработчики
                this.setupEventListeners();

            } catch (error) {
                console.error('[Profile] Failed to load:', error);
                this.showError('Не удалось загрузить профиль');
            }
        }

        async loadUserData() {
            this.profileUser = await window.flumDb.getUserById(this.currentUserId);
            if (!this.profileUser) {
                throw new Error('User not found');
            }

            // Загружаем счетчики
            const followers = await window.flumDb.getFollowers(this.currentUserId);
            const following = await window.flumDb.getFollowing(this.currentUserId);
            
            this.followersCount = followers.length;
            this.followingCount = following.length;
        }

        async loadUserVideos() {
            this.videos = await window.flumDb.getVideosByUser(this.currentUserId);
        }

        async loadFollowStatus() {
            if (window.auth.isAuthenticated && window.auth.getUserId() !== this.currentUserId) {
                this.isFollowing = await window.flumDb.isFollowing(
                    window.auth.getUserId(),
                    this.currentUserId
                );
            }
        }

        // ========== ПЕРЕКЛЮЧЕНИЕ ТАБОВ ==========

        async switchTab(tabId) {
            this.currentTab = tabId;
            
            // Обновляем UI табов
            document.querySelectorAll('.profile-tab').forEach(tab => {
                if (tab.dataset.tab === tabId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });

            // Загружаем контент для таба
            await this.renderTabContent(tabId);
        }

        async renderTabContent(tabId) {
            const grid = document.getElementById('profileVideoGrid');
            if (!grid) return;

            window.utils.emptyElement(grid);

            let videos = [];

            switch (tabId) {
                case 'videos':
                    videos = this.videos;
                    break;
                case 'likes':
                    if (window.auth.isAuthenticated && window.auth.getUserId() === this.currentUserId) {
                        const likedIds = await window.flumDb.getUserLikes(this.currentUserId);
                        videos = await Promise.all(
                            likedIds.map(id => window.flumDb.getVideoById(id))
                        );
                        videos = videos.filter(v => v); // Убираем null
                    }
                    break;
                case 'saved':
                    if (window.auth.isAuthenticated && window.auth.getUserId() === this.currentUserId) {
                        const savedIds = await window.flumDb.getUserSaves(this.currentUserId);
                        videos = await Promise.all(
                            savedIds.map(id => window.flumDb.getVideoById(id))
                        );
                        videos = videos.filter(v => v);
                    }
                    break;
            }

            this.renderVideoGrid(grid, videos);
        }

        // ========== РЕНДЕРИНГ ==========

        render() {
            const container = document.getElementById('profileContent');
            if (!container) return;

            const isOwnProfile = window.auth.isAuthenticated && 
                                window.auth.getUserId() === this.currentUserId;

            container.innerHTML = `
                <div class="profile-header">
                    <div class="profile-header-top">
                        <img class="profile-avatar" src="${this.profileUser.avatar}" alt="avatar" id="profileAvatar">
                        <div class="profile-stats">
                            <div class="stat">
                                <span class="stat-number">${this.videos.length}</span>
                                <span class="stat-label">видео</span>
                            </div>
                            <div class="stat">
                                <span class="stat-number" id="followersCount">${window.utils.formatCount(this.followersCount)}</span>
                                <span class="stat-label">подписчики</span>
                            </div>
                            <div class="stat">
                                <span class="stat-number" id="followingCount">${window.utils.formatCount(this.followingCount)}</span>
                                <span class="stat-label">подписки</span>
                            </div>
                        </div>
                    </div>

                    <div class="profile-name">
                        @${this.profileUser.username}
                        ${this.profileUser.verified ? '<i class="fa-solid fa-circle-check profile-verified"></i>' : ''}
                    </div>

                    <div class="profile-bio" id="profileBio">
                        ${this.profileUser.bio || '👋 Привет! Я в Flum Tik'}
                    </div>

                    <div class="profile-actions">
                        ${isOwnProfile ? `
                            <button class="profile-btn" id="editProfileBtn">
                                <i class="fa-regular fa-pen-to-square"></i> Редактировать
                            </button>
                            <button class="profile-settings-btn" id="settingsBtn">
                                <i class="fa-solid fa-gear"></i>
                            </button>
                        ` : `
                            <button class="profile-btn ${this.isFollowing ? 'following' : 'primary'}" id="followBtn">
                                ${this.isFollowing ? '✓ Подписан' : 'Подписаться'}
                            </button>
                            <button class="profile-btn" id="messageBtn">
                                <i class="fa-regular fa-message"></i>
                            </button>
                        `}
                    </div>
                </div>

                <div class="profile-tabs">
                    <div class="profile-tab active" data-tab="videos">
                        <i class="fa-regular fa-film"></i> Видео
                    </div>
                    ${isOwnProfile ? `
                        <div class="profile-tab" data-tab="likes">
                            <i class="fa-regular fa-heart"></i> Лайки
                        </div>
                        <div class="profile-tab" data-tab="saved">
                            <i class="fa-regular fa-bookmark"></i> Сохраненное
                        </div>
                    ` : ''}
                </div>

                <div class="video-grid" id="profileVideoGrid"></div>
            `;

            // Рендерим сетку видео
            this.renderVideoGrid(document.getElementById('profileVideoGrid'), this.videos);
        }

        renderVideoGrid(container, videos) {
            if (videos.length === 0) {
                container.innerHTML = `
                    <div class="profile-empty">
                        <i class="fa-regular fa-video"></i>
                        <h3>Здесь пока пусто</h3>
                        <p>${this.currentTab === 'videos' ? 'Видео еще не загружены' : 
                           this.currentTab === 'likes' ? 'Нет понравившихся видео' : 
                           'Нет сохраненных видео'}</p>
                        ${this.currentTab === 'videos' && window.auth.isAuthenticated && 
                          window.auth.getUserId() === this.currentUserId ? `
                            <button class="profile-empty-btn" onclick="window.app.loadPage('upload')">
                                Загрузить видео
                            </button>
                        ` : ''}
                    </div>
                `;
                return;
            }

            videos.forEach(video => {
                const item = document.createElement('div');
                item.className = 'grid-video-item';
                item.dataset.videoId = video.id;

                item.innerHTML = `
                    <video class="grid-video" src="${video.url}" muted loop preload="metadata"></video>
                    <div class="grid-video-overlay">
                        <div class="grid-video-stats">
                            <span class="grid-video-stat">
                                <i class="fa-regular fa-heart"></i> ${window.utils.formatCount(video.likes || 0)}
                            </span>
                            <span class="grid-video-stat">
                                <i class="fa-regular fa-comment"></i> ${window.utils.formatCount(video.comments || 0)}
                            </span>
                        </div>
                        <i class="fa-regular fa-circle-play"></i>
                    </div>
                `;

                // При наведении проигрываем превью
                const videoEl = item.querySelector('.grid-video');
                
                item.addEventListener('mouseenter', () => {
                    videoEl.play().catch(() => {});
                });

                item.addEventListener('mouseleave', () => {
                    videoEl.pause();
                    videoEl.currentTime = 0;
                });

                // Клик открывает видео в ленте
                item.addEventListener('click', () => {
                    this.openVideo(video.id);
                });

                container.appendChild(item);
            });
        }

        showSkeleton() {
            const container = document.getElementById('profileContent');
            if (!container) return;

            container.innerHTML = `
                <div class="profile-header skeleton">
                    <div class="profile-header-top">
                        <div class="profile-avatar skeleton"></div>
                        <div class="profile-stats skeleton">
                            <div class="stat skeleton"></div>
                            <div class="stat skeleton"></div>
                            <div class="stat skeleton"></div>
                        </div>
                    </div>
                </div>
                <div class="video-grid skeleton">
                    ${Array(6).fill(0).map(() => `
                        <div class="grid-video-item skeleton"></div>
                    `).join('')}
                </div>
            `;
        }

        showError(message) {
            const container = document.getElementById('profileContent');
            if (!container) return;

            container.innerHTML = `
                <div class="profile-empty">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>${message}</p>
                    <button class="profile-empty-btn" onclick="window.profile.load({ userId: '${this.currentUserId}' })">
                        Попробовать снова
                    </button>
                </div>
            `;
        }

        // ========== ОБРАБОТЧИКИ ==========

        setupEventListeners() {
            // Табы
            document.querySelectorAll('.profile-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    this.switchTab(tab.dataset.tab);
                });
            });

            // Кнопка подписки
            const followBtn = document.getElementById('followBtn');
            if (followBtn) {
                followBtn.addEventListener('click', () => this.toggleFollow());
            }

            // Кнопка сообщения
            const messageBtn = document.getElementById('messageBtn');
            if (messageBtn) {
                messageBtn.addEventListener('click', () => this.openDialog());
            }

            // Кнопка редактирования
            const editBtn = document.getElementById('editProfileBtn');
            if (editBtn) {
                editBtn.addEventListener('click', () => this.openEditModal());
            }

            // Кнопка настроек
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => this.openSettings());
            }

            // Аватар (можно увеличить)
            const avatar = document.getElementById('profileAvatar');
            if (avatar) {
                avatar.addEventListener('click', () => this.showAvatar());
            }
        }

        // ========== ДЕЙСТВИЯ ==========

        async toggleFollow() {
            if (!window.auth.isAuthenticated) {
                const user = await window.auth.showAuthModal();
                if (!user) return;
            }

            try {
                const nowFollowing = await window.auth.toggleFollow(this.currentUserId);
                
                // Обновляем UI
                const btn = document.getElementById('followBtn');
                if (btn) {
                    btn.textContent = nowFollowing ? '✓ Подписан' : 'Подписаться';
                    btn.classList.toggle('following', nowFollowing);
                    btn.classList.toggle('primary', !nowFollowing);
                }

                // Обновляем счетчик
                this.followersCount += nowFollowing ? 1 : -1;
                const countEl = document.getElementById('followersCount');
                if (countEl) {
                    countEl.textContent = window.utils.formatCount(this.followersCount);
                }

                this.isFollowing = nowFollowing;

            } catch (error) {
                console.error('[Profile] Follow failed:', error);
                window.app.showError('Не удалось изменить подписку');
            }
        }

        openDialog() {
            // TODO: реализовать диалоги
            window.app.showError('Диалоги пока в разработке');
        }

        openEditModal() {
            // Создаем модалку редактирования
            const modal = document.createElement('div');
            modal.className = 'modal edit-profile-modal show';
            
            modal.innerHTML = `
                <div class="modal-sheet edit-profile-sheet">
                    <div class="edit-profile-header">
                        <span>Редактировать профиль</span>
                        <span class="edit-profile-close">&times;</span>
                    </div>
                    
                    <div class="edit-avatar-section">
                        <img class="edit-avatar" src="${this.profileUser.avatar}" id="editAvatar">
                        <button class="edit-avatar-change" id="changeAvatarBtn">
                            <i class="fa-regular fa-image"></i> Изменить фото
                        </button>
                        <input type="file" id="avatarInput" accept="image/*" hidden>
                    </div>

                    <div class="edit-field">
                        <label>Имя пользователя</label>
                        <input type="text" id="editUsername" value="${this.profileUser.username}">
                    </div>

                    <div class="edit-field">
                        <label>О себе</label>
                        <textarea id="editBio" rows="4">${this.profileUser.bio || ''}</textarea>
                    </div>

                    <button class="edit-save-btn" id="saveProfileBtn">
                        Сохранить изменения
                    </button>
                </div>
            `;

            document.body.appendChild(modal);

            // Обработчики
            const closeBtn = modal.querySelector('.edit-profile-close');
            closeBtn.addEventListener('click', () => modal.remove());

            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            // Загрузка аватара
            const changeAvatarBtn = modal.querySelector('#changeAvatarBtn');
            const avatarInput = modal.querySelector('#avatarInput');
            const editAvatar = modal.querySelector('#editAvatar');

            changeAvatarBtn.addEventListener('click', () => {
                avatarInput.click();
            });

            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        editAvatar.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Сохранение
            const saveBtn = modal.querySelector('#saveProfileBtn');
            saveBtn.addEventListener('click', async () => {
                const username = modal.querySelector('#editUsername').value;
                const bio = modal.querySelector('#editBio').value;
                const avatarFile = avatarInput.files[0];

                saveBtn.disabled = true;
                saveBtn.textContent = 'Сохранение...';

                try {
                    const updates = { username, bio };
                    
                    if (avatarFile) {
                        // Загружаем новый аватар
                        const uploadResult = await window.imageUploader.uploadImage(avatarFile);
                        updates.avatar = window.yetUploader.getDirectUrl(uploadResult.fileUrl);
                    }

                    await window.auth.updateProfile(updates);
                    
                    modal.remove();
                    this.load({ userId: this.currentUserId });
                    
                    window.app.showSuccess('Профиль обновлен');

                } catch (error) {
                    console.error('[Profile] Update failed:', error);
                    window.app.showError('Не удалось обновить профиль');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Сохранить изменения';
                }
            });
        }

        openSettings() {
            // TODO: реализовать настройки
            window.app.showError('Настройки пока в разработке');
        }

        showAvatar() {
            // TODO: показать аватар на весь экран
        }

        openVideo(videoId) {
            // Прокручиваем ленту к этому видео
            window.app.loadPage('feed');
            
            // Через небольшую задержку ищем видео и прокручиваем к нему
            setTimeout(() => {
                const videoCard = document.querySelector(`.video-card[data-video-id="${videoId}"]`);
                if (videoCard) {
                    videoCard.scrollIntoView({ behavior: 'smooth' });
                }
            }, 300);
        }

        // ========== ОЧИСТКА ==========

        unload() {
            this.currentUserId = null;
            this.profileUser = null;
            this.videos = [];
            super.unload();
        }
    };

    // Создаем глобальный экземпляр
    window.profile = new ProfileComponent();

    console.log('[Profile] Component loaded');
})();
