// auth.js - система авторизации пользователей

(function() {
    'use strict';

    window.Auth = class Auth {
        constructor() {
            this.currentUser = null;
            this.isAuthenticated = false;
            this.listeners = [];
            
            // Пытаемся загрузить сессию при создании
            this.loadSession();
            
            // Ссылка на Firebase (должен быть загружен перед auth.js)
            this.db = window.flumDb;
            
            console.log('[Auth] Initialized');
        }

        // ========== УПРАВЛЕНИЕ СЕССИЕЙ ==========

        // Сохранить сессию в localStorage
        saveSession(user) {
            try {
                const sessionData = {
                    user: user,
                    timestamp: Date.now(),
                    expires: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 дней
                };
                localStorage.setItem('flum_session', JSON.stringify(sessionData));
                console.log('[Auth] Session saved');
            } catch (e) {
                console.warn('[Auth] Failed to save session:', e);
            }
        }

        // Загрузить сессию из localStorage
        loadSession() {
            try {
                const sessionStr = localStorage.getItem('flum_session');
                if (!sessionStr) return false;

                const session = JSON.parse(sessionStr);
                
                // Проверяем не истекла ли сессия
                if (session.expires < Date.now()) {
                    console.log('[Auth] Session expired');
                    this.clearSession();
                    return false;
                }

                this.currentUser = session.user;
                this.isAuthenticated = true;
                
                console.log('[Auth] Session loaded for:', this.currentUser.username);
                this.notifyListeners();
                return true;

            } catch (e) {
                console.warn('[Auth] Failed to load session:', e);
                return false;
            }
        }

        // Очистить сессию
        clearSession() {
            localStorage.removeItem('flum_session');
            this.currentUser = null;
            this.isAuthenticated = false;
            console.log('[Auth] Session cleared');
            this.notifyListeners();
        }

        // ========== АВТОРИЗАЦИЯ ==========

        // Вход пользователя
        async login(username) {
            try {
                if (!username || username.trim().length < 3) {
                    throw new Error('Имя пользователя должно содержать минимум 3 символа');
                }

                // Ищем пользователя в базе
                const user = await this.db.getUserByUsername(username.trim());
                
                if (!user) {
                    throw new Error('Пользователь не найден. Пожалуйста, зарегистрируйтесь.');
                }

                // Обновляем время последнего входа
                await this.db.updateUser(user.id, {
                    lastActive: this.db._timestamp()
                });

                this.currentUser = user;
                this.isAuthenticated = true;
                this.saveSession(user);
                
                console.log('[Auth] Login successful:', user.username);
                this.notifyListeners();
                
                return user;

            } catch (error) {
                console.error('[Auth] Login failed:', error);
                throw error;
            }
        }

        // Регистрация нового пользователя
        async register(username, avatarFile = null) {
            try {
                if (!username || username.trim().length < 3) {
                    throw new Error('Имя пользователя должно содержать минимум 3 символа');
                }

                // Проверяем, не занято ли имя
                const existing = await this.db.getUserByUsername(username);
                if (existing) {
                    throw new Error('Это имя пользователя уже занято');
                }

                let avatarUrl = '';

                // Если загружен аватар, загружаем его через ImageUploader
                if (avatarFile) {
                    try {
                        const uploadResult = await window.imageUploader.uploadImage(avatarFile);
                        avatarUrl = window.yetUploader.getDirectUrl(uploadResult.fileUrl);
                    } catch (uploadError) {
                        console.warn('[Auth] Avatar upload failed, using default:', uploadError);
                        avatarUrl = `https://i.pravatar.cc/150?u=${Date.now()}`;
                    }
                } else {
                    // Генерируем случайный аватар
                    avatarUrl = `https://i.pravatar.cc/150?u=${Date.now()}`;
                }

                // Создаем пользователя в Firebase
                const newUser = await this.db.createUser({
                    username: username.trim(),
                    avatar: avatarUrl,
                    bio: 'Привет! Я в Flum Tik 👋'
                });

                this.currentUser = newUser;
                this.isAuthenticated = true;
                this.saveSession(newUser);

                console.log('[Auth] Registration successful:', newUser.username);
                this.notifyListeners();

                return newUser;

            } catch (error) {
                console.error('[Auth] Registration failed:', error);
                throw error;
            }
        }

        // Выход
        logout() {
            this.clearSession();
            console.log('[Auth] Logout successful');
        }

        // ========== УПРАВЛЕНИЕ ПРОФИЛЕМ ==========

        // Обновить профиль
        async updateProfile(updates) {
            if (!this.isAuthenticated || !this.currentUser) {
                throw new Error('Необходимо войти в систему');
            }

            try {
                // Если обновляем аватар, загружаем новый
                if (updates.avatarFile) {
                    try {
                        const uploadResult = await window.imageUploader.uploadImage(updates.avatarFile);
                        updates.avatar = window.yetUploader.getDirectUrl(uploadResult.fileUrl);
                    } catch (uploadError) {
                        console.warn('[Auth] Avatar update failed:', uploadError);
                        throw new Error('Не удалось загрузить аватар');
                    }
                    delete updates.avatarFile;
                }

                // Обновляем данные в Firebase
                const updatedUser = await this.db.updateUser(this.currentUser.id, updates);

                // Обновляем локального пользователя
                this.currentUser = { ...this.currentUser, ...updatedUser };
                
                // Сохраняем обновленную сессию
                this.saveSession(this.currentUser);
                
                console.log('[Auth] Profile updated');
                this.notifyListeners();
                
                return this.currentUser;

            } catch (error) {
                console.error('[Auth] Profile update failed:', error);
                throw error;
            }
        }

        // Сменить аватар
        async updateAvatar(avatarFile) {
            return this.updateProfile({ avatarFile });
        }

        // Обновить био
        async updateBio(bio) {
            return this.updateProfile({ bio });
        }

        // ========== ПРОВЕРКИ ==========

        // Проверить, подписан ли текущий пользователь на другого
        async isFollowing(userId) {
            if (!this.isAuthenticated || !this.currentUser) return false;
            return await this.db.isFollowing(this.currentUser.id, userId);
        }

        // Подписаться/отписаться
        async toggleFollow(userId) {
            if (!this.isAuthenticated || !this.currentUser) {
                throw new Error('Необходимо войти в систему');
            }
            if (this.currentUser.id === userId) {
                throw new Error('Нельзя подписаться на самого себя');
            }

            return await this.db.toggleFollow(this.currentUser.id, userId);
        }

        // Получить количество подписчиков
        async getFollowersCount(userId) {
            const followers = await this.db.getFollowers(userId);
            return followers.length;
        }

        // Получить количество подписок
        async getFollowingCount(userId) {
            const following = await this.db.getFollowing(userId);
            return following.length;
        }

        // ========== СИСТЕМА ПОДПИСОК ==========

        // Получить ленту (видео от подписок)
        async getFeed(limit = 20) {
            if (!this.isAuthenticated || !this.currentUser) {
                // Если не авторизован, возвращаем популярные видео
                return await this.db.getVideos(limit);
            }

            try {
                // Получаем список подписок
                const following = await this.db.getFollowing(this.currentUser.id);
                
                if (following.length === 0) {
                    // Если нет подписок, возвращаем все видео
                    return await this.db.getVideos(limit);
                }

                // Получаем все видео
                const allVideos = await this.db.getVideos(100);
                
                // Фильтруем видео от подписок
                const feedVideos = allVideos
                    .filter(video => following.includes(video.userId))
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, limit);

                return feedVideos;

            } catch (error) {
                console.error('[Auth] Failed to get feed:', error);
                return await this.db.getVideos(limit);
            }
        }

        // ========== РАБОТА С ЛАЙКАМИ И СОХРАНЕНИЯМИ ==========

        // Лайкнуть видео
        async likeVideo(videoId) {
            if (!this.isAuthenticated || !this.currentUser) {
                throw new Error('Необходимо войти в систему');
            }
            return await this.db.toggleLike(this.currentUser.id, videoId);
        }

        // Проверить, лайкнуто ли видео
        async isVideoLiked(videoId) {
            if (!this.isAuthenticated || !this.currentUser) return false;
            return await this.db.isLiked(this.currentUser.id, videoId);
        }

        // Сохранить видео
        async saveVideo(videoId) {
            if (!this.isAuthenticated || !this.currentUser) {
                throw new Error('Необходимо войти в систему');
            }
            return await this.db.toggleSave(this.currentUser.id, videoId);
        }

        // Проверить, сохранено ли видео
        async isVideoSaved(videoId) {
            if (!this.isAuthenticated || !this.currentUser) return false;
            return await this.db.isSaved(this.currentUser.id, videoId);
        }

        // Получить лайкнутые видео
        async getLikedVideos() {
            if (!this.isAuthenticated || !this.currentUser) return [];
            
            const likedIds = await this.db.getUserLikes(this.currentUser.id);
            const videos = [];
            
            for (const id of likedIds) {
                const video = await this.db.getVideoById(id);
                if (video) videos.push(video);
            }
            
            return videos;
        }

        // Получить сохраненные видео
        async getSavedVideos() {
            if (!this.isAuthenticated || !this.currentUser) return [];
            
            const savedIds = await this.db.getUserSaves(this.currentUser.id);
            const videos = [];
            
            for (const id of savedIds) {
                const video = await this.db.getVideoById(id);
                if (video) videos.push(video);
            }
            
            return videos;
        }

        // ========== СИСТЕМА СОБЫТИЙ ==========

        // Подписаться на изменения авторизации
        addListener(callback) {
            this.listeners.push(callback);
            // Сразу вызываем с текущим состоянием
            callback(this.currentUser, this.isAuthenticated);
        }

        // Удалить подписку
        removeListener(callback) {
            const index = this.listeners.indexOf(callback);
            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        }

        // Уведомить всех подписчиков
        notifyListeners() {
            this.listeners.forEach(callback => {
                try {
                    callback(this.currentUser, this.isAuthenticated);
                } catch (e) {
                    console.warn('[Auth] Listener error:', e);
                }
            });
        }

        // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

        // Получить текущего пользователя
        getUser() {
            return this.currentUser;
        }

        // Проверить авторизацию
        checkAuth() {
            return this.isAuthenticated;
        }

        // Получить ID текущего пользователя
        getUserId() {
            return this.currentUser?.id || null;
        }

        // Получить имя текущего пользователя
        getUsername() {
            return this.currentUser?.username || 'Гость';
        }

        // Проверить, является ли пользователь владельцем контента
        isOwner(userId) {
            return this.isAuthenticated && this.currentUser?.id === userId;
        }

        // ========== UI ДЛЯ АВТОРИЗАЦИИ ==========

        // Показать модалку авторизации
        showAuthModal(options = {}) {
            const modal = document.getElementById('authModal');
            if (!modal) {
                console.warn('[Auth] Auth modal not found');
                return;
            }

            // Сброс формы
            const usernameInput = document.getElementById('authUsername');
            const previewImg = document.getElementById('previewImg');
            const avatarFile = document.getElementById('authAvatarFile');
            
            if (usernameInput) usernameInput.value = '';
            if (previewImg) previewImg.src = 'https://i.pravatar.cc/150?u=' + Date.now();
            if (avatarFile) avatarFile.value = '';

            // Показываем модалку
            modal.classList.add('show');
            
            // Возвращаем промис, который разрешится при успешной авторизации
            return new Promise((resolve, reject) => {
                const onLogin = async () => {
                    try {
                        const username = usernameInput.value.trim();
                        const user = await this.login(username);
                        this.hideAuthModal();
                        cleanup();
                        resolve(user);
                    } catch (error) {
                        alert(error.message);
                    }
                };

                const onRegister = async () => {
                    try {
                        const username = usernameInput.value.trim();
                        const file = avatarFile.files[0];
                        const user = await this.register(username, file);
                        this.hideAuthModal();
                        cleanup();
                        resolve(user);
                    } catch (error) {
                        alert(error.message);
                    }
                };

                const cleanup = () => {
                    document.getElementById('loginBtn')?.removeEventListener('click', onLogin);
                    document.getElementById('registerBtn')?.removeEventListener('click', onRegister);
                    document.getElementById('closeAuth')?.removeEventListener('click', onClose);
                };

                const onClose = () => {
                    this.hideAuthModal();
                    cleanup();
                    reject(new Error('Auth cancelled'));
                };

                // Добавляем обработчики
                document.getElementById('loginBtn')?.addEventListener('click', onLogin);
                document.getElementById('registerBtn')?.addEventListener('click', onRegister);
                document.getElementById('closeAuth')?.addEventListener('click', onClose);
                
                // Предпросмотр аватара
                avatarFile?.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            previewImg.src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            });
        }

        // Скрыть модалку авторизации
        hideAuthModal() {
            const modal = document.getElementById('authModal');
            if (modal) {
                modal.classList.remove('show');
            }
        }

        // Показать уведомление о необходимости авторизации
        requireAuth(action = 'выполнить это действие') {
            if (!this.isAuthenticated) {
                if (confirm(`Необходимо войти в систему, чтобы ${action}. Хотите войти?`)) {
                    this.showAuthModal();
                }
                return false;
            }
            return true;
        }
    };

    // Создаем глобальный экземпляр
    window.auth = new Auth();

    console.log('[Auth] System ready');
})();
