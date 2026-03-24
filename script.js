document.addEventListener('DOMContentLoaded', () => {
    // Получаем данные из объекта MAX Bridge
    const webApp = window.WebApp;
    // Ожидается, что данные в webApp.initDataUnsafe или напрямую в webApp
    // В документации указано: initDataUnsafe.start_param с данными из URL
    const initDataUnsafe = webApp?.initDataUnsafe || {};
    // В некоторых случаях webApp.initData напрямую содержит start_param для MAX Apps, но 
    // скорее всего это в initDataUnsafe, или как start_param в объекте startParam.

    // Элементы UI
    const elGreeting = document.getElementById('greeting');
    const elUsername = document.getElementById('username');
    const elUserId = document.getElementById('userId');
    const elStartParam = document.getElementById('startParam');
    const elUserAvatar = document.getElementById('userAvatar');
    const elAvatarPlaceholder = document.getElementById('avatarPlaceholder');

    // Получение данных пользователя
    const user = initDataUnsafe.user;
    let fallbackChar = 'U';

    if (user) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Пользователь';
        fallbackChar = fullName.charAt(0).toUpperCase();

        elGreeting.textContent = `Привет, ${firstName || 'Друг'}!`;
        elUsername.textContent = `@${user.username || 'неизвестно'}`;
        elUserId.textContent = user.id || '-';

        // Обработка аватарки
        if (user.photo_url) {
            elUserAvatar.src = user.photo_url;
            elUserAvatar.style.display = 'block';
            elAvatarPlaceholder.style.display = 'none';
        } else {
            // Заглушка, если нет фото
            elAvatarPlaceholder.textContent = fallbackChar;
        }
    } else {
        elGreeting.textContent = "Добро пожаловать!";
        elUsername.textContent = "Запущено вне MAX";
        elAvatarPlaceholder.textContent = "M";
    }

    // Получение параметра запуска
    // Согласно документации MAX, startapp параметры в initDataUnsafe.start_param
    let startParam = initDataUnsafe.start_param;
    if (!startParam && webApp?.start_param) {
        startParam = webApp.start_param;
    }

    // Если тестируем локально, можем взять из URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (!startParam && urlParams.has('startapp')) {
        startParam = urlParams.get('startapp');
    }

    if (startParam) {
        elStartParam.textContent = startParam;
    } else {
        elStartParam.textContent = "Не задан (пусто)";
    }

    // Логика перенаправления
    let targetChannel = null; // Будет загружено динамически

    // Начинаем асинхронную загрузку ссылки или дашборда
    if (startParam && startParam.startsWith('links_')) {
        // Режим дашборда
        document.querySelector('.info-section').style.display = 'none'; // Скрываем инфо пользователя
        document.getElementById('greeting').textContent = 'Статистика';
        document.getElementById('username').textContent = 'Загрузка данных...';

        fetch(`https://g-ads.pro/api/plug/tracker/links/${startParam}`)
            .then(res => {
                if (!res.ok) throw new Error("Dashboard not found or token expired");
                return res.json();
            })
            .then(data => {
                document.getElementById('username').textContent = 'Доступ разрешен';
                const dashboard = document.getElementById('linksDashboard');
                const container = document.getElementById('linksContainer');
                dashboard.style.display = 'flex'; // info-section display is flex by default in css usually or block

                const links = data.data.links;
                if (!links || links.length === 0) {
                    container.innerHTML = '<div class="info-item"><span class="val" style="text-align:center; width: 100%;">Нет активных ссылок</span></div>';
                } else {
                    container.innerHTML = links.map(l => `
                        <div class="info-item" style="flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px;">
                            <strong style="color: var(--accent); font-size: 16px;">${l.name}</strong>
                            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis;">startapp: ${l.startapp_hash}</div>
                            <div style="display: flex; gap: 10px; margin-top: 4px;">
                                <span style="background: rgba(129, 140, 248, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600;">🖱 ${l.clicks || 0}</span>
                                <span style="background: rgba(52, 211, 153, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; color: #34d399;">👥 ${l.subscriptions || 0}</span>
                            </div>
                        </div>
                    `).join('');
                }
            })
            .catch(err => {
                console.error("Ошибка дашборда:", err);
                document.getElementById('greeting').textContent = "Ошибка доступа";
                document.getElementById('username').textContent = "Ссылка устарела или неверна";
            });
    } else if (startParam && startParam !== "Не задан (пусто)") {
        fetch(`https://g-ads.pro/api/plug/tracker/${startParam}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user: initDataUnsafe.user || null })
        })
            .then(res => {
                if (!res.ok) throw new Error("Tracker link not found");
                return res.json();
            })
            .then(data => {
                targetChannel = data.url;
                doRedirect();
            })
            .catch(err => {
                console.error("Ошибка получения ссылки:", err);
                // Фолбэк канал, если API недоступно или код неверен
                targetChannel = "https://max.ru/max_ru";
                doRedirect();
            });
    } else {
        targetChannel = "https://max.ru/max_ru";
        doRedirect();
    }

    // Функция редиректа
    function doRedirect() {
        if (!targetChannel) return; // Защита

        // Внутри MAX — используем нативный метод
        if (webApp && typeof webApp.openMaxLink === 'function') {
            webApp.openMaxLink(targetChannel);
        }
        // Надёжный фолбэк (браузер / GitHub Pages preview)
        window.location.href = targetChannel;
    }

    // Тактильный отклик при загрузке
    if (webApp?.HapticFeedback) {
        try { webApp.HapticFeedback.notificationOccurred('success'); } catch (e) { }
    }

});
