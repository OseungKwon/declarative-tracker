import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // link 로 연결된 라이브러리가 루트의 react 를 가져오지 않도록 하나로 맞춘다
  resolve: { dedupe: ['react', 'react-dom'] },
});
