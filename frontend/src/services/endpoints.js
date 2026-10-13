// Quản lý tập trung các Endpoints API
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  TABLES: {
    BASE: '/tables',
    BY_ID: (id) => `/tables/${id}`,
    STATUS: (id) => `/tables/${id}/status`,
    CURRENT_ORDER: (id) => `/tables/${id}/current-order`,
    TRANSFER: (id) => `/tables/${id}/transfer`,
    MERGE: (id) => `/tables/${id}/merge`,
  },
  ORDERS: {
    BASE: '/orders',
    BY_ID: (id) => `/orders/${id}`,
    STATUS: (id) => `/orders/${id}/status`,
    KITCHEN: '/orders/kitchen',
    ITEM_STATUS: (itemId) => `/orders/items/${itemId}/status`,
  },
  MENU: {
    ITEMS: '/menu-items',
    ITEM_BY_ID: (id) => `/menu-items/${id}`,
    TOGGLE: (id) => `/menu-items/${id}/toggle`,
    CATEGORIES: '/categories',
    CATEGORY_BY_ID: (id) => `/categories/${id}`,
  },
  PAYMENTS: {
    BASE: '/payments',
  },
  DASHBOARD: {
    STATS: '/dashboard/stats',
    REVENUE_CHART: '/dashboard/revenue-chart',
    RECENT_ORDERS: '/dashboard/recent-orders',
  },
  USERS: {
    BASE: '/users',
    BY_ID: (id) => `/users/${id}`,
  },
}
