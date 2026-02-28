// upload.js - компонент загрузки видео

(function() {
    'use strict';

    window.UploadComponent = class UploadComponent extends window.BaseComponent {
        constructor() {
            super('Upload');
            this.selectedFile = null;
            this.videoPreview = null;
            this.videoDuration = 0;
            this.uploadProgress = 0;
            this.isUploading = false;
            this.musicOptions = [
                { title: 'Оригинальный звук', artist: 'Flum Tik' },
                { title: 'Phonk Ремикс', artist: 'Phonk House' },
                { title: 'Лофи для учебы', artist: 'Lofi Girl' },
                { title: 'Танцевальный хит', artist: 'Dance Music' },
                { title: 'Спокойный джаз', artist: 'Jazz Vibes' }
            ];
        }

        // ========== ИНИЦИАЛИЗАЦИЯ ==========

        async load(params = {}) {
            await super.load(params);

            // Проверяем авторизацию
            if (!window.auth.isAuthenticated) {
                window.app.loadPage('feed');
                return;
            }

            this.render();
            this.setupEventListeners();
        }

        render() {
            const container = document.getElementById('page-upload');
            if (!container) return;

            container.innerHTML = `
                <div class="upload-container">
                    <h1 class="upload-title">Загрузить видео</h1>

                    <!-- Область загрузки -->
                    <div class="upload-area" id="uploadArea">
                        <i class="fa-solid fa-cloud-upload-alt"></i>
                        <div class="upload-area-title">
                            Нажмите или перетащите видео
                        </div>
                        <div class="upload-area-hint">
                            MP4, MOV, WebM до 500MB · длительность до 3 минут
                        </div>
                    </div>

                    <!-- Превью видео (скрыто по умолчанию) -->
                    <div class="upload-preview" id="uploadPreview" style="display: none;">
                        <video id="previewVideo" controls></video>
                        <div class="upload-preview-badge" id="previewBadge"></div>
                        <div class="upload-preview-time" id="previewTime">0:00</div>
                    </div>

                    <!-- Прогресс загрузки (скрыт по умолчанию) -->
                    <div class="upload-progress" id="uploadProgress">
                        <div class="upload-progress-header">
                            <span>Загрузка на сервер...</span>
                            <span id="progressPercent">0%</span>
                        </div>
                        <div class="upload-progress-bar">
                            <div class="upload-progress-fill" id="progressBar" style="width: 0%;"></div>
                        </div>
                        <div class="upload-progress-status" id="progressStatus">
                            Подготовка...
                        </div>
                    </div>

                    <!-- Информация о выбранном файле (скрыта по умолчанию) -->
                    <div class="upload-file-info" id="fileInfo" style="display: none;">
                        <div class="upload-file-icon">
                            <i class="fa-solid fa-video"></i>
                        </div>
                        <div class="upload-file-details">
                            <div class="upload-file-name" id="fileName"></div>
                            <div class="upload-file-size" id="fileSize"></div>
                        </div>
                        <div class="upload-file-remove" id="removeFile">
                            <i class="fa-solid fa-times"></i>
                        </div>
                    </div>

                    <!-- Форма загрузки (скрыта по умолчанию) -->
                    <div id="uploadForm" style="display: none;">
                        <!-- Подпись -->
                        <div class="upload-input-group">
                            <label class="upload-label">
                                <i class="fa-regular fa-pen-to-square"></i> Подпись к видео
                            </label>
                            <input type="text" class="upload-input" id="videoCaption" 
                                   placeholder="Напишите что-нибудь о видео...">
                        </div>

                        <!-- Выбор музыки -->
                        <div class="upload-music-selector" id="musicSelector">
                            <div class="upload-music-header">
                                <div class="upload-music-icon">
                                    <i class="fa-solid fa-music"></i>
                                </div>
                                <div class="upload-music-info">
                                    <div class="upload-music-title" id="selectedMusicTitle">
                                        Оригинальный звук
                                    </div>
                                    <div class="upload-music-artist" id="selectedMusicArtist">
                                        Flum Tik
                                    </div>
                                </div>
                                <i class="fa-solid fa-chevron-down upload-music-arrow"></i>
                            </div>
                            <div class="upload-music-list" id="musicList">
                                ${this.musicOptions.map((music, index) => `
                                    <div class="upload-music-item ${index === 0 ? 'selected' : ''}" 
                                         data-music='${JSON.stringify(music)}'>
                                        <i class="fa-regular fa-circle-check upload-music-check"></i>
                                        <div class="upload-music-info">
                                            <div class="upload-music-title">${music.title}</div>
                                            <div class="upload-music-artist">${music.artist}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Приватность -->
                        <div class="upload-privacy">
                            <div class="upload-privacy-title">
                                <i class="fa-regular fa-eye"></i> Кто может смотреть
                            </div>
                            <div class="upload-privacy-options">
                                <label class="upload-privacy-option selected" data-privacy="public">
                                    <i class="fa-regular fa-globe"></i>
                                    <span>Все</span>
                                </label>
                                <label class="upload-privacy-option" data-privacy="followers">
                                    <i class="fa-regular fa-users"></i>
                                    <span>Подписчики</span>
                                </label>
                                <label class="upload-privacy-option" data-privacy="private">
                                    <i class="fa-regular fa-lock"></i>
                                    <span>Только я</span>
                                </label>
                            </div>
                        </div>

                        <!-- Кнопка публикации -->
                        <button class="upload-publish-btn" id="publishBtn" disabled>
                            Опубликовать
                        </button>
                    </div>

                    <input type="file" id="videoFile" accept="video/*" hidden>
                </div>
            `;
        }

        // ========== ОБРАБОТЧИКИ ==========

        setupEventListeners() {
            // Drag & drop область
            const uploadArea = document.getElementById('uploadArea');
            const videoInput = document.getElementById('videoFile');

            uploadArea.addEventListener('click', () => {
                videoInput.click();
            });

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('video/')) {
                    this.handleFileSelect(file);
                } else {
                    window.app.showError('Пожалуйста, выберите видео файл');
                }
            });

            // Выбор файла через input
            videoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileSelect(file);
                }
            });

            // Удаление файла
            const removeBtn = document.getElementById('removeFile');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => this.clearSelection());
            }

            // Выбор музыки
            const musicSelector = document.getElementById('musicSelector');
            if (musicSelector) {
                musicSelector.addEventListener('click', () => {
                    musicSelector.classList.toggle('expanded');
                });
            }

            // Выбор трека из списка
            document.querySelectorAll('.upload-music-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectMusic(item);
                });
            });

            // Выбор приватности
            document.querySelectorAll('.upload-privacy-option').forEach(option => {
                option.addEventListener('click', () => {
                    document.querySelectorAll('.upload-privacy-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    option.classList.add('selected');
                });
            });

            // Публикация
            const publishBtn = document.getElementById('publishBtn');
            if (publishBtn) {
                publishBtn.addEventListener('click', () => this.publishVideo());
            }

            // Поля ввода активируют кнопку
            const captionInput = document.getElementById('videoCaption');
            if (captionInput) {
                captionInput.addEventListener('input', () => this.checkPublishButton());
            }
        }

        // ========== РАБОТА С ФАЙЛАМИ ==========

        async handleFileSelect(file) {
            try {
                // Валидация
                await this.validateVideo(file);

                // Сохраняем файл
                this.selectedFile = file;

                // Создаем превью
                await this.createPreview(file);

                // Показываем информацию о файле
                this.showFileInfo(file);

                // Показываем форму
                document.getElementById('uploadForm').style.display = 'block';

                // Активируем кнопку
                this.checkPublishButton();

                // Скрываем область загрузки
                document.getElementById('uploadArea').style.display = 'none';

            } catch (error) {
                console.error('[Upload] File validation failed:', error);
                window.app.showError(error.message);
            }
        }

        async validateVideo(file) {
            // Проверка типа
            const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
            if (!validTypes.includes(file.type)) {
                throw new Error('Неподдерживаемый формат видео. Используйте MP4, MOV, WebM или MKV');
            }

            // Проверка размера (500MB)
            const maxSize = 500 * 1024 * 1024;
            if (file.size > maxSize) {
                throw new Error('Видео слишком большое. Максимальный размер 500MB');
            }

            // Проверка длительности
            const duration = await this.getVideoDuration(file);
            if (duration > 180) { // 3 минуты
                throw new Error('Видео слишком длинное. Максимальная длительность 3 минуты');
            }

            this.videoDuration = duration;
            return true;
        }

        getVideoDuration(file) {
            return new Promise((resolve, reject) => {
                const video = document.createElement('video');
                video.preload = 'metadata';

                video.onloadedmetadata = () => {
                    URL.revokeObjectURL(video.src);
                    resolve(video.duration);
                };

                video.onerror = () => {
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Не удалось загрузить видео'));
                };

                video.src = URL.createObjectURL(file);
            });
        }

        async createPreview(file) {
            const preview = document.getElementById('uploadPreview');
            const previewVideo = document.getElementById('previewVideo');
            const previewTime = document.getElementById('previewTime');
            const previewBadge = document.getElementById('previewBadge');

            // Очищаем предыдущий превью
            if (this.videoPreview) {
                URL.revokeObjectURL(this.videoPreview);
            }

            this.videoPreview = URL.createObjectURL(file);
            previewVideo.src = this.videoPreview;

            // Обновляем время
            previewTime.textContent = window.utils.formatDuration(this.videoDuration);

            // Обновляем бейдж качества
            previewBadge.textContent = this.getQualityBadge(file);

            preview.style.display = 'block';
        }

        getQualityBadge(file) {
            if (file.size > 100 * 1024 * 1024) return 'HD';
            if (file.size > 50 * 1024 * 1024) return 'SD';
            return '📱';
        }

        showFileInfo(file) {
            const fileInfo = document.getElementById('fileInfo');
            const fileName = document.getElementById('fileName');
            const fileSize = document.getElementById('fileSize');

            fileName.textContent = file.name;
            fileSize.textContent = window.utils.formatFileSize(file.size);

            fileInfo.style.display = 'flex';
        }

        clearSelection() {
            this.selectedFile = null;
            
            if (this.videoPreview) {
                URL.revokeObjectURL(this.videoPreview);
                this.videoPreview = null;
            }

            // Сбрасываем UI
            document.getElementById('uploadArea').style.display = 'block';
            document.getElementById('uploadPreview').style.display = 'none';
            document.getElementById('fileInfo').style.display = 'none';
            document.getElementById('uploadForm').style.display = 'none';
            document.getElementById('videoFile').value = '';

            // Сбрасываем форму
            document.getElementById('videoCaption').value = '';
            this.checkPublishButton();
        }

        // ========== ВЫБОР МУЗЫКИ ==========

        selectMusic(item) {
            // Убираем выделение у всех
            document.querySelectorAll('.upload-music-item').forEach(i => {
                i.classList.remove('selected');
            });

            // Выделяем выбранный
            item.classList.add('selected');

            // Обновляем заголовок
            const musicData = JSON.parse(item.dataset.music);
            document.getElementById('selectedMusicTitle').textContent = musicData.title;
            document.getElementById('selectedMusicArtist').textContent = musicData.artist;

            // Закрываем список
            document.getElementById('musicSelector').classList.remove('expanded');
        }

        // ========== ПУБЛИКАЦИЯ ==========

        checkPublishButton() {
            const publishBtn = document.getElementById('publishBtn');
            const caption = document.getElementById('videoCaption')?.value;
            
            if (this.selectedFile && caption && caption.trim().length > 0) {
                publishBtn.disabled = false;
            } else {
                publishBtn.disabled = true;
            }
        }

        async publishVideo() {
            if (this.isUploading) return;

            const publishBtn = document.getElementById('publishBtn');
            const progress = document.getElementById('uploadProgress');
            const progressBar = document.getElementById('progressBar');
            const progressPercent = document.getElementById('progressPercent');
            const progressStatus = document.getElementById('progressStatus');

            try {
                this.isUploading = true;
                publishBtn.disabled = true;
                publishBtn.classList.add('loading');
                progress.style.display = 'block';

                // Получаем данные из формы
                const caption = document.getElementById('videoCaption').value;
                const selectedMusic = document.querySelector('.upload-music-item.selected');
                const musicData = selectedMusic ? JSON.parse(selectedMusic.dataset.music) : null;
                const privacy = document.querySelector('.upload-privacy-option.selected').dataset.privacy;

                // Симулируем прогресс
                const progressInterval = setInterval(() => {
                    if (this.uploadProgress < 90) {
                        this.uploadProgress += 5;
                        progressBar.style.width = `${this.uploadProgress}%`;
                        progressPercent.textContent = `${this.uploadProgress}%`;
                        
                        if (this.uploadProgress < 30) {
                            progressStatus.textContent = 'Подготовка видео...';
                        } else if (this.uploadProgress < 60) {
                            progressStatus.textContent = 'Загрузка на сервер...';
                        } else {
                            progressStatus.textContent = 'Обработка видео...';
                        }
                    }
                }, 200);

                // Загружаем видео через VideoUploader
                const uploadResult = await window.videoUploader.uploadVideo(
                    this.selectedFile,
                    caption,
                    musicData ? musicData.title : 'оригинальный звук'
                );

                clearInterval(progressInterval);
                this.uploadProgress = 100;
                progressBar.style.width = '100%';
                progressPercent.textContent = '100%';
                progressStatus.textContent = 'Сохранение...';

                // Сохраняем в Firebase
                const videoData = {
                    userId: window.auth.getUserId(),
                    url: window.yetUploader.getDirectUrl(uploadResult.fileUrl),
                    shortHash: uploadResult.shortHash,
                    caption: caption,
                    music: musicData ? musicData.title : 'оригинальный звук',
                    privacy: privacy,
                    duration: uploadResult.duration
                };

                const savedVideo = await window.flumDb.createVideo(videoData);

                // Показываем успех
                window.app.showSuccess('Видео успешно опубликовано!');

                // Переходим в ленту
                setTimeout(() => {
                    window.app.loadPage('feed');
                }, 1500);

            } catch (error) {
                console.error('[Upload] Publish failed:', error);
                window.app.showError('Не удалось опубликовать видео: ' + error.message);
                
                // Сбрасываем прогресс
                this.uploadProgress = 0;
                document.getElementById('uploadProgress').style.display = 'none';
                
            } finally {
                this.isUploading = false;
                publishBtn.classList.remove('loading');
                this.checkPublishButton();
            }
        }

        // ========== ОЧИСТКА ==========

        unload() {
            if (this.videoPreview) {
                URL.revokeObjectURL(this.videoPreview);
                this.videoPreview = null;
            }
            this.selectedFile = null;
            this.uploadProgress = 0;
            this.isUploading = false;
            super.unload();
        }
    };

    // Создаем глобальный экземпляр
    window.upload = new UploadComponent();

    console.log('[Upload] Component loaded');
})();
