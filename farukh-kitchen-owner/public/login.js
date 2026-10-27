'use strict';
const form = document.getElementById('login');
const msg = document.getElementById('message');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const usernameInput = form.querySelector('input[name="username"]');
  const passwordInput = form.querySelector('input[name="password"]');
  msg.textContent = 'Проверка доступа…';
  button.disabled = true;
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось войти');
    passwordInput.value = '';
    window.location.replace('/admin');
  } catch (error) {
    msg.textContent = error instanceof Error ? error.message : 'Ошибка входа';
  } finally {
    button.disabled = false;
  }
});
