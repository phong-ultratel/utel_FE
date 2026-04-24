// Dung voi: ng serve --configuration=be7979 (+ proxy.conf.be7979.json).
// apiBaseUrl '/api' de mo FE bang IP LAN (http://<IP>:7978) van goi dung BE tren cung server (proxy -> 127.0.0.1:7979).
// Neu build tung file roi host bang nginx, can cau hinh nginx proxy /api -> BE:7979.
export const environment = {
  production: false,
  apiBaseUrl: '/api'
};
