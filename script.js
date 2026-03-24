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

    // Начинаем асинхронную загрузку ссылки
    if (startParam && startParam !== "Не задан (пусто)") {
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
