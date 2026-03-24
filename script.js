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
                            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis;">startapp: https://max.ru/id1655460755_bo?${l.startapp_hash}</div>
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
    } else if (startParam && startParam.startsWith('stats_')) {
        // Режим статистики
        document.querySelector('.info-section').style.display = 'none';
        document.getElementById('greeting').textContent = 'Аналитика канала';
        document.getElementById('username').textContent = 'Загрузка данных...';

        fetch(`https://g-ads.pro/api/plug/tracker/stats/${startParam}`)
            .then(res => {
                if (!res.ok) throw new Error("Stats not found or token expired");
                return res.json();
            })
            .then(data => {
                document.getElementById('username').textContent = 'Доступ разрешен';
                const dashboard = document.getElementById('linksDashboard');
                const container = document.getElementById('linksContainer');
                dashboard.style.display = 'block';

                const report = data.data.report;
                if (!report || report.length === 0) {
                    container.innerHTML = '<div class="info-item"><span class="val" style="text-align:center; width: 100%;">Нет данных для отчета</span></div>';
                } else {
                    // Функция форматирования интервала PostgreSQL
                    function fmtInterval(val) {
                        if (!val) return '-';
                        // PostgreSQL interval comes as object or string like "1 day 02:30:00"
                        if (typeof val === 'object' && val !== null) {
                            const d = val.days || 0;
                            const h = val.hours || 0;
                            const m = val.minutes || 0;
                            const parts = [];
                            if (d > 0) parts.push(d + ' дн.');
                            if (h > 0) parts.push(h + ' ч.');
                            if (m > 0) parts.push(m + ' мин.');
                            return parts.length > 0 ? parts.join(' ') : '0 сек.';
                        }
                        return String(val);
                    }

                    let html = '<div style="overflow-x: auto; width: 100%;"><table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 700px;">';
                    html += '<thead><tr style="background: rgba(129, 140, 248, 0.15);">';
                    const headers = ['Период', 'Подп.', 'Отпис.', 'Актив.', 'Отписки %', 'Свежие отп.', 'Свежие %', 'Актив. (б/св)', 'LT', 'LT отпис.', 'LT отп. (б/св)'];
                    headers.forEach(h => { html += `<th style="padding: 6px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); white-space: nowrap;">${h}</th>`; });
                    html += '</tr></thead><tbody>';

                    report.forEach(r => {
                        html += '<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">';
                        html += `<td style="padding: 5px 4px; text-align: center; white-space: nowrap;">${r.date}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; color: #34d399; font-weight: 600;">${r.ev_new}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; color: #f87171; font-weight: 600;">${r.ev_exit}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-weight: 600;">${r.ev_active}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.churn_rate}%</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.exit_fresh}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.churn_fresh}%</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.active_no_fresh}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_cohort)}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_left)}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_left_not_fresh)}</td>`;
                        html += '</tr>';
                    });

                    html += '</tbody></table></div>';
                    container.innerHTML = html;
                }
            })
            .catch(err => {
                console.error("Ошибка статистики:", err);
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
