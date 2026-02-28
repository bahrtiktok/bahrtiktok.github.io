// firebase.js - работа с Firebase Realtime Database

(function() {
    'use strict';

    // Глобальный объект для работы с Firebase
    window.FlumFirebase = class FlumFirebase {
        constructor() {
            this.baseUrl = window.FLUM_CONFIG.firebaseUrl;
            this.cache = {
                users: new Map(),
                videos: new Map()
            };
        }

        // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========
        
        async _fetch(path, options = {}) {
            const url = `${this.baseUrl}${path}.json`;
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('Firebase fetch error:', error);
                throw error;
            }
        }

        _generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        _timestamp() {
            return new Date().toISOString();
        }

        // ========== РАБОТА С ПОЛЬЗОВАТЕЛЯМИ ==========

        // Получить всех пользователей
        async getUsers() {
            const users = await this._fetch('/users');
            if (users) {
                Object.entries(users).forEach(([id, user]) => {
                    this.cache.users.set(id, { ...user, id });
                });
            }
            return this.cache.users;
        }

        // Получить пользователя по ID
        async getUserById(userId) {
            if (this.cache.users.has(userId)) {
                return this.cache.users.get(userId);
            }
            
            const user = await this._fetch(`/users/${userId}`);
            if (user) {
                this.cache.users.set(userId, { ...user, id: userId });
            }
            return user ? { ...user, id: userId } : null;
        }

        // Получить пользователя по имени
        async getUserByUsername(username) {
            const users = await this.getUsers();
            for (const [id, user] of users) {
                if (user.username?.toLowerCase() === username.toLowerCase()) {
                    return { ...user, id };
                }
            }
            return null;
        }

        // Создать нового пользователя
        async createUser(userData) {
            const userId = this._generateId();
            const newUser = {
                username: userData.username,
                avatar: userData.avatar || 'https://i.pravatar.cc/150?u=' + userId,
                bio: userData.bio || '',
                verified: false,
                followers: 0,
                following: 0,
                videos: 0,
                createdAt: this._timestamp(),
                lastActive: this._timestamp()
            };

            await this._fetch(`/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(newUser)
            });

            this.cache.users.set(userId, { ...newUser, id: userId });
            return { ...newUser, id: userId };
        }

        // Обновить пользователя
        async updateUser(userId, updates) {
            const user = await this.getUserById(userId);
            if (!user) throw new Error('User not found');

            const updatedUser = {
                ...user,
                ...updates,
                lastActive: this._timestamp()
            };
            delete updatedUser.id;

            await this._fetch(`/users/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });

            this.cache.users.set(userId, { ...updatedUser, id: userId });
            return { ...updatedUser, id: userId };
        }

        // Подписаться/отписаться
        async toggleFollow(followerId, followingId) {
            if (followerId === followingId) return;

            const followKey = `${followerId}_${followingId}`;
            const followPath = `/follows/${followKey}`;
            
            const existing = await this._fetch(followPath);
            
            if (existing) {
                // Отписаться
                await this._fetch(followPath, { method: 'DELETE' });
                
                // Обновить счетчики
                const follower = await this.getUserById(followerId);
                const following = await this.getUserById(followingId);
                
                await this.updateUser(followerId, { following: (follower.following || 1) - 1 });
                await this.updateUser(followingId, { followers: (following.followers || 1) - 1 });
                
                return false; // отписался
            } else {
                // Подписаться
                await this._fetch(followPath, {
                    method: 'PUT',
                    body: JSON.stringify({
                        followerId,
                        followingId,
                        createdAt: this._timestamp()
                    })
                });
                
                // Обновить счетчики
                const follower = await this.getUserById(followerId);
                const following = await this.getUserById(followingId);
                
                await this.updateUser(followerId, { following: (follower.following || 0) + 1 });
                await this.updateUser(followingId, { followers: (following.followers || 0) + 1 });
                
                return true; // подписался
            }
        }

        // Проверить подписку
        async isFollowing(followerId, followingId) {
            if (!followerId || !followingId || followerId === followingId) return false;
            const followKey = `${followerId}_${followingId}`;
            const follow = await this._fetch(`/follows/${followKey}`);
            return !!follow;
        }

        // Получить подписчиков пользователя
        async getFollowers(userId) {
            const follows = await this._fetch('/follows');
            if (!follows) return [];
            
            return Object.entries(follows)
                .filter(([_, value]) => value.followingId === userId)
                .map(([key, value]) => value.followerId);
        }

        // Получить подписки пользователя
        async getFollowing(userId) {
            const follows = await this._fetch('/follows');
            if (!follows) return [];
            
            return Object.entries(follows)
                .filter(([_, value]) => value.followerId === userId)
                .map(([key, value]) => value.followingId);
        }

        // ========== РАБОТА С ВИДЕО ==========

        // Получить все видео (с пагинацией)
        async getVideos(limit = 10, startAfter = null) {
            let url = '/videos?orderBy="$key"';
            if (limit) url += `&limitToLast=${limit}`;
            if (startAfter) url += `&startAfter="${startAfter}"`;
            
            const videos = await this._fetch(url);
            if (!videos) return [];
            
            const videoList = Object.entries(videos)
                .map(([id, video]) => ({ ...video, id }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Кешируем
            videoList.forEach(video => this.cache.videos.set(video.id, video));
            
            return videoList;
        }

        // Получить видео по ID
        async getVideoById(videoId) {
            if (this.cache.videos.has(videoId)) {
                return this.cache.videos.get(videoId);
            }
            
            const video = await this._fetch(`/videos/${videoId}`);
            if (video) {
                this.cache.videos.set(videoId, { ...video, id: videoId });
            }
            return video ? { ...video, id: videoId } : null;
        }

        // Получить видео пользователя
        async getVideosByUser(userId, limit = 50) {
            const videos = await this._fetch('/videos');
            if (!videos) return [];
            
            const userVideos = Object.entries(videos)
                .filter(([_, video]) => video.userId === userId)
                .map(([id, video]) => ({ ...video, id }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, limit);
            
            return userVideos;
        }

        // Создать видео
        async createVideo(videoData) {
            const videoId = this._generateId();
            const newVideo = {
                userId: videoData.userId,
                url: videoData.url,
                shortHash: videoData.shortHash,
                caption: videoData.caption || '',
                music: videoData.music || 'оригинальный звук',
                likes: 0,
                comments: 0,
                saves: 0,
                privacy: videoData.privacy || 'public',
                duration: videoData.duration || 0,
                createdAt: this._timestamp()
            };

            await this._fetch(`/videos/${videoId}`, {
                method: 'PUT',
                body: JSON.stringify(newVideo)
            });

            // Обновить счетчик видео у пользователя
            const user = await this.getUserById(videoData.userId);
            if (user) {
                await this.updateUser(videoData.userId, { videos: (user.videos || 0) + 1 });
            }

            this.cache.videos.set(videoId, { ...newVideo, id: videoId });
            return { ...newVideo, id: videoId };
        }

        // Удалить видео
        async deleteVideo(videoId) {
            const video = await this.getVideoById(videoId);
            if (!video) return;

            await this._fetch(`/videos/${videoId}`, { method: 'DELETE' });
            
            // Обновить счетчик видео у пользователя
            const user = await this.getUserById(video.userId);
            if (user) {
                await this.updateUser(video.userId, { videos: Math.max(0, (user.videos || 1) - 1) });
            }

            // Удалить все лайки, комментарии и сохранения для этого видео
            await this._fetch(`/likes/${videoId}`, { method: 'DELETE' });
            await this._fetch(`/comments/${videoId}`, { method: 'DELETE' });
            await this._fetch(`/saves/${videoId}`, { method: 'DELETE' });

            this.cache.videos.delete(videoId);
        }

        // ========== ЛАЙКИ ==========

        // Лайкнуть/анлайкнуть видео
        async toggleLike(userId, videoId) {
            const likeKey = `${userId}_${videoId}`;
            const likePath = `/likes/${likeKey}`;
            
            const existing = await this._fetch(likePath);
            const video = await this.getVideoById(videoId);
            
            if (existing) {
                // Убрать лайк
                await this._fetch(likePath, { method: 'DELETE' });
                await this._fetch(`/videos/${videoId}/likes`, {
                    method: 'PATCH',
                    body: JSON.stringify((video.likes || 1) - 1)
                });
                return false;
            } else {
                // Поставить лайк
                await this._fetch(likePath, {
                    method: 'PUT',
                    body: JSON.stringify({
                        userId,
                        videoId,
                        createdAt: this._timestamp()
                    })
                });
                await this._fetch(`/videos/${videoId}/likes`, {
                    method: 'PATCH',
                    body: JSON.stringify((video.likes || 0) + 1)
                });
                return true;
            }
        }

        // Проверить, лайкнул ли пользователь видео
        async isLiked(userId, videoId) {
            if (!userId || !videoId) return false;
            const likeKey = `${userId}_${videoId}`;
            const like = await this._fetch(`/likes/${likeKey}`);
            return !!like;
        }

        // Получить все лайки пользователя
        async getUserLikes(userId) {
            const likes = await this._fetch('/likes');
            if (!likes) return [];
            
            return Object.entries(likes)
                .filter(([_, value]) => value.userId === userId)
                .map(([_, value]) => value.videoId);
        }

        // ========== СОХРАНЕНИЯ ==========

        // Сохранить/убрать сохранение видео
        async toggleSave(userId, videoId) {
            const saveKey = `${userId}_${videoId}`;
            const savePath = `/saves/${saveKey}`;
            
            const existing = await this._fetch(savePath);
            const video = await this.getVideoById(videoId);
            
            if (existing) {
                // Убрать из сохраненного
                await this._fetch(savePath, { method: 'DELETE' });
                await this._fetch(`/videos/${videoId}/saves`, {
                    method: 'PATCH',
                    body: JSON.stringify((video.saves || 1) - 1)
                });
                return false;
            } else {
                // Сохранить
                await this._fetch(savePath, {
                    method: 'PUT',
                    body: JSON.stringify({
                        userId,
                        videoId,
                        createdAt: this._timestamp()
                    })
                });
                await this._fetch(`/videos/${videoId}/saves`, {
                    method: 'PATCH',
                    body: JSON.stringify((video.saves || 0) + 1)
                });
                return true;
            }
        }

        // Проверить, сохранено ли видео
        async isSaved(userId, videoId) {
            if (!userId || !videoId) return false;
            const saveKey = `${userId}_${videoId}`;
            const save = await this._fetch(`/saves/${saveKey}`);
            return !!save;
        }

        // Получить сохраненные видео пользователя
        async getUserSaves(userId) {
            const saves = await this._fetch('/saves');
            if (!saves) return [];
            
            return Object.entries(saves)
                .filter(([_, value]) => value.userId === userId)
                .map(([_, value]) => value.videoId);
        }

        // ========== КОММЕНТАРИИ ==========

        // Получить комментарии к видео
        async getComments(videoId) {
            const comments = await this._fetch(`/comments/${videoId}`);
            if (!comments) return [];
            
            return Object.entries(comments)
                .map(([id, comment]) => ({ ...comment, id }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Добавить комментарий
        async addComment(userId, videoId, text) {
            const commentId = this._generateId();
            const newComment = {
                userId,
                videoId,
                text: text.trim(),
                likes: 0,
                createdAt: this._timestamp()
            };

            await this._fetch(`/comments/${videoId}/${commentId}`, {
                method: 'PUT',
                body: JSON.stringify(newComment)
            });

            // Обновить счетчик комментариев у видео
            const video = await this.getVideoById(videoId);
            if (video) {
                await this._fetch(`/videos/${videoId}/comments`, {
                    method: 'PATCH',
                    body: JSON.stringify((video.comments || 0) + 1)
                });
            }

            return { ...newComment, id: commentId };
        }

        // Удалить комментарий
        async deleteComment(videoId, commentId) {
            const comment = await this._fetch(`/comments/${videoId}/${commentId}`);
            if (!comment) return;

            await this._fetch(`/comments/${videoId}/${commentId}`, { method: 'DELETE' });

            // Обновить счетчик комментариев у видео
            const video = await this.getVideoById(videoId);
            if (video) {
                await this._fetch(`/videos/${videoId}/comments`, {
                    method: 'PATCH',
                    body: JSON.stringify(Math.max(0, (video.comments || 1) - 1))
                });
            }
        }

        // ========== ПОИСК ==========

        // Поиск пользователей
        async searchUsers(query) {
            const users = await this.getUsers();
            const lowerQuery = query.toLowerCase();
            
            return Array.from(users.values())
                .filter(user => 
                    user.username?.toLowerCase().includes(lowerQuery) ||
                    user.bio?.toLowerCase().includes(lowerQuery)
                )
                .slice(0, 20);
        }

        // Поиск видео (по подписи или музыке)
        async searchVideos(query) {
            const videos = await this._fetch('/videos');
            if (!videos) return [];
            
            const lowerQuery = query.toLowerCase();
            
            return Object.entries(videos)
                .filter(([_, video]) => 
                    video.caption?.toLowerCase().includes(lowerQuery) ||
                    video.music?.toLowerCase().includes(lowerQuery)
                )
                .map(([id, video]) => ({ ...video, id }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 30);
        }

        // ========== СТАТИСТИКА ==========

        // Получить общую статистику
        async getStats() {
            const [users, videos] = await Promise.all([
                this._fetch('/users'),
                this._fetch('/videos')
            ]);

            return {
                totalUsers: users ? Object.keys(users).length : 0,
                totalVideos: videos ? Object.keys(videos).length : 0,
                timestamp: this._timestamp()
            };
        }

        // Очистить кеш
        clearCache() {
            this.cache.users.clear();
            this.cache.videos.clear();
        }
    };

    // Создаем глобальный экземпляр
    window.flumDb = new FlumFirebase();
})();
