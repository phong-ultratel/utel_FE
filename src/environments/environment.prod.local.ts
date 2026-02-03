export const environment = {
  production: true,
  // Sử dụng relative path để có thể dùng proxy khi test production build local
  // Proxy sẽ chuyển tiếp /api/* đến https://admin.ultratel.vn/api/*
  apiBaseUrl: '/api'
};

