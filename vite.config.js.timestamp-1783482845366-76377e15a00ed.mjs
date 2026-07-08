// vite.config.js
import { defineConfig } from "file:///C:/FirstLogicMetaLab/BLITHE/blith_web_portal/node_modules/vite/dist/node/index.js";
import react from "file:///C:/FirstLogicMetaLab/BLITHE/blith_web_portal/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/events/",
  plugins: [react()],
  assetsInclude: ["**/*.PNG"],
  server: {
    proxy: {
      "/razorpay-api": {
        target: "https://api.razorpay.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/razorpay-api/, "")
      }
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxGaXJzdExvZ2ljTWV0YUxhYlxcXFxCTElUSEVcXFxcYmxpdGhfd2ViX3BvcnRhbFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcRmlyc3RMb2dpY01ldGFMYWJcXFxcQkxJVEhFXFxcXGJsaXRoX3dlYl9wb3J0YWxcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L0ZpcnN0TG9naWNNZXRhTGFiL0JMSVRIRS9ibGl0aF93ZWJfcG9ydGFsL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IGNvbW1hbmQgfSkgPT4gKHtcclxuICBiYXNlOiBjb21tYW5kID09PSAnc2VydmUnID8gJy8nIDogJy9ldmVudHMvJyxcclxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgYXNzZXRzSW5jbHVkZTogWycqKi8qLlBORyddLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9yYXpvcnBheS1hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cHM6Ly9hcGkucmF6b3JwYXkuY29tJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL3Jhem9ycGF5LWFwaS8sICcnKVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59KSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4VCxTQUFTLG9CQUFvQjtBQUMzVixPQUFPLFdBQVc7QUFHbEIsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxRQUFRLE9BQU87QUFBQSxFQUM1QyxNQUFNLFlBQVksVUFBVSxNQUFNO0FBQUEsRUFDbEMsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLGVBQWUsQ0FBQyxVQUFVO0FBQUEsRUFDMUIsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsaUJBQWlCO0FBQUEsUUFDZixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxTQUFTLENBQUMsU0FBUyxLQUFLLFFBQVEsbUJBQW1CLEVBQUU7QUFBQSxNQUN2RDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
