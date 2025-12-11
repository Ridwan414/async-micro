const API_BASE = '';

// Health Check
async function checkHealth() {
  const container = document.getElementById('health-status');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    container.innerHTML = `
      <span class="status-badge ok">Gateway: ${data.status}</span>
    `;
  } catch (error) {
    container.innerHTML = `<span class="status-badge error">Gateway: offline</span>`;
  }
}

// Items (MongoDB)
async function loadItems() {
  const list = document.getElementById('items-list');
  try {
    const res = await fetch(`${API_BASE}/api/items`);
    const items = await res.json();

    if (items.length === 0) {
      list.innerHTML = '<li class="empty">No items yet. Add one above!</li>';
      return;
    }

    list.innerHTML = items.map(item => `
      <li>
        <div class="item-info">
          <div class="item-name">${escapeHtml(item.name)}</div>
          ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ''}
        </div>
        <button class="btn btn-danger" onclick="deleteItem('${item._id}')">Delete</button>
      </li>
    `).join('');
  } catch (error) {
    list.innerHTML = `<li class="error">Failed to load items: ${error.message}</li>`;
  }
}

async function addItem(e) {
  e.preventDefault();
  const name = document.getElementById('item-name').value.trim();
  const description = document.getElementById('item-description').value.trim();

  if (!name) return;

  try {
    const res = await fetch(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });

    if (res.ok) {
      document.getElementById('item-name').value = '';
      document.getElementById('item-description').value = '';
      loadItems();
    }
  } catch (error) {
    console.error('Failed to add item:', error);
  }
}

async function deleteItem(id) {
  try {
    await fetch(`${API_BASE}/api/items/${id}`, { method: 'DELETE' });
    loadItems();
  } catch (error) {
    console.error('Failed to delete item:', error);
  }
}

// Products
async function loadProducts() {
  const container = document.getElementById('products-list');
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    const products = await res.json();

    if (!Array.isArray(products) || products.length === 0) {
      container.innerHTML = '<p class="empty">No products available</p>';
      return;
    }

    container.innerHTML = products.map(p => `
      <div class="product-card">
        <h3>${escapeHtml(p.name || 'Unnamed')}</h3>
        <div class="price">$${(p.price || 0).toFixed(2)}</div>
        <div class="stock">Stock: ${p.stock || 0}</div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<p class="empty">Product service unavailable</p>';
  }
}

// Tasks
async function createTask(e) {
  e.preventDefault();
  const name = document.getElementById('task-name').value.trim();
  const result = document.getElementById('task-result');

  if (!name) return;

  try {
    const res = await fetch(`${API_BASE}/api/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: name })
    });

    const data = await res.json();
    result.className = res.ok ? 'success' : 'error';
    result.textContent = res.ok ? `Task created: ${JSON.stringify(data)}` : `Error: ${data.error}`;

    if (res.ok) {
      document.getElementById('task-name').value = '';
    }
  } catch (error) {
    result.className = 'error';
    result.textContent = `Error: ${error.message}`;
  }
}

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  loadItems();
  loadProducts();

  document.getElementById('item-form').addEventListener('submit', addItem);
  document.getElementById('task-form').addEventListener('submit', createTask);

  // Refresh health every 30s
  setInterval(checkHealth, 30000);
});
